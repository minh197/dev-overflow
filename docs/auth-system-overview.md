# DevOverflow Authentication System Overview

This document explains the core logic of the current authentication system so it can be presented to an engineering audience.

## 1) High-Level Design

DevOverflow uses a backend-owned auth model:

- **Backend:** NestJS (`apps/api`) is the source of truth for identity, sessions, tokens, and social linking.
- **Database:** Prisma models in `packages/database/prisma/schema.prisma` persist users, provider links, reset/link tokens, and sessions.
- **Frontend:** Next.js (`apps/web`) consumes auth endpoints and relies on `HttpOnly` cookies for session continuity.

Why this design:

- Keeps security-critical logic server-side.
- Aligns with the existing API-first architecture.
- Allows social auth + account linking without duplicating identity logic in the frontend.

## 2) Core Data Model

Auth-related schema entities:

- **`User`**
  - Required identity: `email`, `username`
  - Local auth: `passwordHash` (nullable for social-only users)
  - Verification state: `emailVerifiedAt`
- **`Account`**
  - Maps user to social provider identity
  - Unique by `(provider, providerAccountId)`
- **`AuthToken`**
  - Stores hashed one-time tokens with TTL
  - Used for `PASSWORD_RESET` and `ACCOUNT_LINK`
  - Supports single-use semantics via `consumedAt`
- **`Session`**
  - Stores hashed refresh token and session metadata (`userAgent`, `ipAddress`)
  - Supports revocation (`revokedAt`) and rolling expiry

Enums:

- `AuthProvider`: `GITHUB`, `GOOGLE`
- `AuthTokenType`: `EMAIL_VERIFICATION`, `PASSWORD_RESET`, `ACCOUNT_LINK`

## 3) Auth API Surface

Auth routes in `apps/api/src/modules/auth/auth.controller.ts`:

- `POST /auth/sign-up`
- `POST /auth/sign-in`
- `POST /auth/sign-out`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/:provider` (OAuth start)
- `GET /auth/:provider/callback` (OAuth callback)
- `POST /auth/link/resolve`
- `POST /auth/link/:provider`
- `POST /auth/unlink/:provider`

Question mutation authorization is now guarded:

- `POST /questions`
- `PATCH /questions/:id`
- `DELETE /questions/:id`

## 4) Session and Cookie Strategy

Cookie names and lifetimes (`apps/api/src/modules/auth/auth.constants.ts`):

- Access cookie: `devoverflow_access_token` (15 minutes)
- Refresh cookie: `devoverflow_refresh_token` (30 days)

Cookie security settings:

- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: true` in production
- `path: '/'`

Token persistence:

- Access token payload includes user id + session id.
- Refresh token is never stored raw; only SHA-256 hash is stored in `Session`.
- Refresh rotation is enforced on `refresh` and fallback paths.

## 5) Main User Flows

### A) Local Sign-Up / Sign-In

1. Validate input DTO.
2. Normalize email and enforce uniqueness.
3. Hash password with `bcrypt`.
4. Create or load user.
5. Create `Session` row with hashed refresh token.
6. Set access + refresh cookies.
7. Return sanitized user profile.

### B) Session Restore (`GET /auth/me`)

1. Attempt access-token authentication.
2. If missing/expired, attempt refresh-token rotation.
3. If refresh succeeds, issue fresh cookies and return user.
4. If both fail, return unauthorized.

### C) Forgot / Reset Password

1. `forgot-password` creates one-time reset token (`AuthToken`) with TTL.
2. In non-production, API returns a dev reset URL for local testing.
3. `reset-password` consumes token (single-use), updates password hash, and revokes prior sessions.
4. New session is issued immediately after successful reset.

### D) Social Sign-In and Account Linking

1. `GET /auth/:provider` generates provider URL with signed state payload.
2. Callback exchanges code for provider profile.
3. Cases:
   - Existing provider link -> sign in directly.
   - No link, email exists -> create `ACCOUNT_LINK` token and redirect to conflict page.
   - No link, new email -> create user + provider account link, then sign in.
4. `POST /auth/link/resolve` consumes link token and attaches provider account.
5. `POST /auth/unlink/:provider` prevents removing last remaining login method.

## 6) Authorization Model

Guards in `apps/api/src/modules/auth/access-token.guard.ts`:

- `AccessTokenGuard`: requires authenticated user.
- `OptionalAccessTokenGuard`: injects user when present, otherwise continues.

This enables:

- Personalized but public reads (optional guard on some GET routes).
- Strict protection for data-changing actions.

## 7) Frontend Integration

Client auth API wrapper:

- `apps/web/src/lib/api/auth-api.ts`

Key behavior:

- `fetchAuthMe()` returns `null` on 401 (clean unauthenticated state).
- Auth calls (`signIn`, `signUp`, `signOut`, `forgotPassword`, `resetPassword`, etc.) map directly to backend endpoints.
- Axios is configured with `withCredentials: true` to include cookies.

Route-level UX gating (`apps/web/src/middleware.ts`):

- Redirect unauthenticated users from protected pages to `/sign-in?next=...`.
- Redirect authenticated users away from `/sign-in` and `/sign-up`.

Auth pages implemented under `apps/web/src/app/(auth)/`:

- `sign-in`
- `sign-up`
- `forgot-password`
- `forgot-password/check-email`
- `reset-password/[token]`
- `account-link-conflict`

## 8) Security Decisions

Important security properties:

- Passwords are hashed (`bcrypt`), never stored in plaintext.
- Refresh tokens and one-time tokens are hashed before persistence.
- Link/reset tokens are single-use and time-bounded.
- Session invalidation on sign-out and password reset.
- Provider linking guarded against cross-user collisions.
- Backend authorization is mandatory for mutating endpoints.

## 9) Demo Script for Presentation

Suggested walkthrough:

1. Explain architecture (backend-owned auth + cookie sessions).
2. Show schema: `User`, `Account`, `AuthToken`, `Session`.
3. Demo sign-up and sign-in.
4. Show `GET /auth/me` session restoration behavior.
5. Demo forgot-password + reset flow.
6. Demo social login and account-link conflict resolution.
7. Show protected route redirect behavior.
8. Close with security controls and tradeoffs.

## 10) Current Environment Requirements

Backend env vars:

- `DATABASE_URL`
- `JWT_SECRET`
- `API_BASE_URL`
- `WEB_APP_URL`
- `CORS_ORIGIN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Frontend env vars:

- `NEXT_PUBLIC_API_URL`
