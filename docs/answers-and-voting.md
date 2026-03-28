# Answers, voting, and sorting

This document describes how user-authored answers, upvotes/downvotes, and answer sorting work in DevOverflow: data model, API, transactions, and web integration.

## Goals

- Let authenticated users post answers on questions.
- Let users cast at most one vote per post (up, down, or none), with separate tallies for upvotes and downvotes (as in common Q&A UIs).
- Sort answers by highest upvote count by default, with an option to sort by newest.
- Keep vote tallies consistent with the canonical vote rows under concurrency.

## Data model

### Questions and answers as posts

After the questions/posts refactor, **both questions and answers are rows in `posts`** ([`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma)):

| Concept   | `Post` fields |
|-----------|----------------|
| Question  | `type: QUESTION`, `parentQuestionId: null` |
| Answer    | `type: ANSWER`, `parentQuestionId` → parent question’s post `id` |

Answer bodies live in `bodyMdx`. The parent question’s **`answerCount`** is denormalized on the question post for list views and filters (e.g. “unanswered”).

### Votes and counters

**`votes`** stores one row per `(userId, postId)` with `value` in `{ 1, -1 }` (no row means “no vote”).

**`posts`** also stores **`upVoteCount`** and **`downVoteCount`**, maintained when votes change so listing and sorting stay cheap without aggregating `votes` on every read.

## Design: why transactions for voting

A single “change vote” operation touches:

1. The **`votes`** row (insert, update, or delete).
2. The **`posts`** row (increment/decrement `upVoteCount` and/or `downVoteCount` by a computed delta).

If those steps were not atomic, a crash or partial failure could leave counts out of sync with the sum of votes. All vote mutations therefore run inside **`prisma.$transaction`**.

For concurrency, the implementation locks the target post row with **`SELECT id FROM posts WHERE id = $id FOR UPDATE`** at the start of the transaction so two concurrent requests serialize their counter updates on that post. The unique constraint on `(userId, postId)` still prevents duplicate votes from the same user.

Alternative designs (aggregate-only tallies, or DB triggers) are possible; this project keeps denormalized counters for performance and fixes them in one transactional unit.

## Backend API

### `POST /questions/:id/answers` (authenticated)

- **Handler:** [`QuestionsController`](../apps/api/src/modules/questions/questions.controller.ts) → `QuestionsService.createAnswer`.
- **Body:** `{ bodyMdx: string }` ([`CreateAnswerDto`](../apps/api/src/modules/questions/dto/create-answer.dto.ts)).
- **Behavior:** In a transaction:
  - Ensures the parent exists, is `QUESTION`, and `ACTIVE`.
  - Creates a child `Post` with `type: ANSWER`, `parentQuestionId`, and trimmed `bodyMdx`.
  - **`answerCount`** on the parent question is incremented by 1.
- **Response:** Full question detail (same shape as `GET /questions/:id`), including answers.

### `POST /posts/:id/vote` (authenticated)

- **Handler:** [`PostsController`](../apps/api/src/modules/posts/posts.controller.ts) → [`PostsService.castVote`](../apps/api/src/modules/posts/posts.service.ts).
- **Body:** `{ value: 1 | -1 | 0 }` ([`CastVoteDto`](../apps/api/src/modules/posts/dto/cast-vote.dto.ts)): upvote, downvote, or clear vote.
- **Behavior:** In a transaction (with row lock as above):
  - Target must exist, be `ACTIVE`, and be `QUESTION` or `ANSWER`.
  - **Cannot vote on your own post** (`403`).
  - Loads existing vote; computes **delta** for up/down counts (e.g. switching +1 → −1 removes one up and adds one down).
  - **`value === 0`:** delete vote row if present; otherwise **upsert** the vote.
  - Applies **`increment`** on `upVoteCount` / `downVoteCount` when the delta is non-zero.
- **Response:** `{ postId, upVoteCount, downVoteCount, userVote }` for the client to refresh UI without necessarily refetching the whole question.

### `GET /questions/:id` (optional auth)

- **Query:** `answerSort=upvotes | newest` ([`GetQuestionQueryDto`](../apps/api/src/modules/questions/dto/get-question-query.dto.ts)).
- **Ordering of answers:**
  - **`upvotes` (default):** `upVoteCount` descending, then `createdAt` ascending.
  - **`newest`:** `createdAt` descending, then `id` descending.
- **Payload extensions:**
  - Question: `downVoteCount`, `currentUserVote` (`1`, `-1`, or omitted/`null` when logged out or no vote).
  - Each answer: `downVoteCount`, `currentUserVote`, plus existing author and `upVoteCount`.

Implementation detail: when a user is present, the service loads their vote row per answer (and for the question) via a constrained relation so the client can highlight active up/down state.

## Frontend (`apps/web`)

- **API layer:** [`homepage-api.ts`](../apps/web/src/lib/api/homepage-api.ts) — `fetchQuestionById(id, answerSort)`, `createAnswer`, `castVote`.
- **Types:** [`homepage-types.ts`](../apps/web/src/lib/homepage-types.ts) — answer-level `upVoteCount`, `downVoteCount`, `currentUserVote`; optional question-level vote fields.
- **Question page:** [`app/questions/[id]/page.tsx`](../apps/web/src/app/questions/[id]/page.tsx):
  - Sort `<select>` bound to query key `["question-detail", questionId, answerSort]`.
  - **`VoteCluster`** ([`components/questions/vote-cluster.tsx`](../apps/web/src/components/questions/vote-cluster.tsx)) for question and each answer; toggling the same direction clears the vote (`0` on the API).
  - “Your answer” composer calls `createAnswer`; React Query invalidates/updates question detail and homepage question lists where answer counts matter.
  - Signed-out users see counts and links to sign in; voting and posting require auth (cookies via `apiClient`).

## Vote semantics (quick reference)

| Previous vote | Action        | Effect |
|---------------|---------------|--------|
| None          | Up            | +1 up |
| None          | Down          | +1 down |
| Up            | Up again      | Clear (−1 up) |
| Down          | Down again    | Clear (−1 down) |
| Up            | Down          | −1 up, +1 down |
| Down          | Up            | −1 down, +1 up |

Explicit **`value: 0`** clears the vote if one exists.

## Related code map

| Area | Location |
|------|----------|
| Prisma schema | `packages/database/prisma/schema.prisma` (`Post`, `Vote`) |
| Question + answers + sort | `apps/api/src/modules/questions/questions.service.ts` |
| Vote endpoint | `apps/api/src/modules/posts/posts.service.ts` |
| App module wiring | `apps/api/src/app.module.ts` (`PostsModule`) |

## Operational notes

- If counters ever drift (e.g. manual DB edits), reconcile with aggregates from `votes` or a one-off maintenance script; normal app traffic should not drift if all writes go through `PostsService.castVote`.
- Deleting a question cascades related child posts and their dependencies per schema `onDelete` rules; vote cleanup on the question itself is also handled in delete flows where applicable.
