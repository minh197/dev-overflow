import { Injectable } from '@nestjs/common';
import { Prisma, PostStatus, PostType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetGlobalSearchQueryDto } from './dto/get-global-search-query.dto';

// ---------------------------------------------------------------------------
// Row types returned after Prisma hydration
// ---------------------------------------------------------------------------

type SearchQuestionRow = {
  id: number;
  title: string | null;
  createdAt: Date;
  user: { username: string; fullName: string | null };
  questionTags: Array<{ tag: { displayName: string } }>;
};

type SearchAnswerRow = {
  id: number;
  bodyMdx: string;
  createdAt: Date;
  user: { username: string; fullName: string | null };
  parentQuestion: { id: number; title: string | null } | null;
};

type SearchUserRow = {
  id: number;
  username: string;
  fullName: string | null;
  reputation: number;
};

type SearchTagRow = {
  id: number;
  slug: string;
  displayName: string;
  questionCount: number;
};

// Raw row returned from the FTS $queryRaw call.
// Prisma returns PostgreSQL INTEGER as number and REAL as number.
// Using bigint | number union to be safe across Prisma versions.
type FtsHit = { id: bigint | number; rank: number };

// ---------------------------------------------------------------------------
// Composite ranking formula (kept in sync with the SQL in migration):
//   rank = ts_rank_cd(search_vector, query) * 0.6
//        + LEAST(up_vote_count, 1000)::float / 1000.0 * 0.25
//        + EXTRACT(EPOCH FROM created_at)::float
//          / EXTRACT(EPOCH FROM NOW())::float * 0.15
//
// ts_rank_cd          → text relevance normalised to [0,1]
// normalized_votes    → vote count capped at 1000, scaled to [0,1]
// normalized_recency  → ratio of post epoch to now epoch, ≤1 for any past date
// ---------------------------------------------------------------------------

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Feature flags
  //
  // SEARCH_FTS_POSTS=true       enable FTS path for posts (default: off until
  //                             indexes are deployed and verified in prod)
  // SEARCH_TAG_PREFETCH=false   disable Phase 1A tag pre-fetch (default: on)
  // SEARCH_BODY_GUARDRAIL=false disable skipping body scan for short queries
  //                             (default: on)
  // -------------------------------------------------------------------------
  private get flags() {
    return {
      useFtsPosts: process.env.SEARCH_FTS_POSTS === 'true',
      useTagPrefetch: process.env.SEARCH_TAG_PREFETCH !== 'false',
      useBodyGuardrail: process.env.SEARCH_BODY_GUARDRAIL !== 'false',
    };
  }

  // -------------------------------------------------------------------------
  // Query router (Phase 3)
  //
  // 'short_partial': no spaces AND length < 4
  //   → trigram only; questions body scan suppressed by SEARCH_BODY_GUARDRAIL
  // 'fts': everything else
  //   → FTS primary, trigram/tag top-up fallback
  //
  // Edge-case reference (DTO enforces MinLength(2) so empty/1-char blocked):
  //   "re"         → short_partial (len 2, no space)
  //   "rea"        → short_partial (len 3, no space)
  //   "reac"       → fts           (len 4)
  //   "react"      → fts           (len 5)
  //   "react hooks"→ fts           (contains space)
  //   "404"        → fts           (len 3... wait, 3 < 4 → short_partial)
  //   "c++"        → short_partial (len 3, no space)
  // -------------------------------------------------------------------------
  classifyQuery(q: string): 'short_partial' | 'fts' {
    if (!q.includes(' ') && q.length < 4) return 'short_partial';
    return 'fts';
  }

  // -------------------------------------------------------------------------
  // Formatting helpers (unchanged from original)
  // -------------------------------------------------------------------------

  private toRelativeLabel(date: Date) {
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diffMs / (60 * 1000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  private compactWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private snippet(value: string, query: string, maxLength = 140) {
    const normalized = this.compactWhitespace(value);
    if (normalized.length <= maxLength) return normalized;
    const lower = normalized.toLowerCase();
    const queryIndex = lower.indexOf(query.toLowerCase());
    const start = Math.max(0, queryIndex === -1 ? 0 : queryIndex - 36);
    const end = Math.min(normalized.length, start + maxLength);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < normalized.length ? '...' : '';
    return `${prefix}${normalized.slice(start, end)}${suffix}`;
  }

  private reputationLabel(value: number) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m rep`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k rep`;
    return `${value} rep`;
  }

  // -------------------------------------------------------------------------
  // Phase 1A: Tag ID pre-fetch
  //
  // Pre-fetching tag IDs before the main Promise.all lets the question query
  // use a simple semi-join on question_tags.tag_id (index lookup) instead of
  // a nested join with a text predicate inside — see searchQuestionsTrigram.
  // -------------------------------------------------------------------------
  private async prefetchTagIds(q: string): Promise<number[]> {
    const tags = await this.prisma.tag.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return tags.map((t) => t.id);
  }

  // -------------------------------------------------------------------------
  // Hydration helpers
  //
  // FTS raw queries return only (id, rank). Prisma findMany hydrates the
  // display fields. Re-sorting by rankMap preserves the FTS relevance order
  // since Prisma does not guarantee IN-clause row ordering.
  // -------------------------------------------------------------------------

  private async hydrateQuestions(
    orderedIds: number[],
    rankMap: Map<number, number>,
  ): Promise<SearchQuestionRow[]> {
    if (orderedIds.length === 0) return [];
    const rows = (await this.prisma.post.findMany({
      where: { id: { in: orderedIds } },
      select: {
        id: true,
        title: true,
        createdAt: true,
        user: { select: { username: true, fullName: true } },
        questionTags: { select: { tag: { select: { displayName: true } } } },
      },
    })) as SearchQuestionRow[];
    return rows.sort(
      (a, b) => (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0),
    );
  }

  private async hydrateAnswers(
    orderedIds: number[],
    rankMap: Map<number, number>,
  ): Promise<SearchAnswerRow[]> {
    if (orderedIds.length === 0) return [];
    const rows = (await this.prisma.post.findMany({
      where: { id: { in: orderedIds } },
      select: {
        id: true,
        bodyMdx: true,
        createdAt: true,
        user: { select: { username: true, fullName: true } },
        parentQuestion: { select: { id: true, title: true } },
      },
    })) as SearchAnswerRow[];
    return rows.sort(
      (a, b) => (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0),
    );
  }

  // -------------------------------------------------------------------------
  // Phase 2 + Phase 4: FTS search paths
  //
  // Raw SQL returns (id, rank) using the composite ranking formula.
  // Three-tier result assembly for questions:
  //   1. FTS hits              — ranked by composite score
  //   2. Tag-matched top-up    — questions found via pre-fetched tag IDs
  //   3. Trigram title top-up  — title ILIKE fallback for any remaining slots
  //
  // IMPORTANT: $queryRaw uses Prisma tagged templates. All interpolated
  // values are passed as parameterised query arguments ($1, $2, …).
  // Never use $queryRawUnsafe with string interpolation here — doing so
  // would open SQL injection via the search term.
  // -------------------------------------------------------------------------

  private async searchQuestionsFts(
    q: string,
    limit: number,
    tagIds: number[],
  ): Promise<SearchQuestionRow[]> {
    const ftsHits = await this.prisma.$queryRaw<FtsHit[]>`
      SELECT
        id,
        (
          ts_rank_cd(search_vector, query) * 0.6 +
          LEAST(up_vote_count, 1000)::float / 1000.0 * 0.25 +
          EXTRACT(EPOCH FROM created_at)::float /
            EXTRACT(EPOCH FROM NOW())::float * 0.15
        ) AS rank
      FROM posts, plainto_tsquery('english', ${q}) AS query
      WHERE search_vector @@ query
        AND type = 'QUESTION'
        AND status = 'ACTIVE'
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    const ftsIds = ftsHits.map((r) => Number(r.id));
    const rankMap = new Map<number, number>(
      ftsHits.map((r) => [Number(r.id), Number(r.rank)]),
    );

    // Tier 2: tag-matched questions not already in FTS results
    const tagOnlyIds: number[] = [];
    const tagSlots = limit - ftsIds.length;
    if (tagSlots > 0 && tagIds.length > 0) {
      const tagRows = await this.prisma.post.findMany({
        where: {
          type: PostType.QUESTION,
          status: PostStatus.ACTIVE,
          ...(ftsIds.length > 0 ? { id: { notIn: ftsIds } } : {}),
          questionTags: { some: { tagId: { in: tagIds } } },
        },
        orderBy: [{ upVoteCount: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
        take: tagSlots,
      });
      tagOnlyIds.push(...tagRows.map((r) => r.id));
      tagOnlyIds.forEach((id) => rankMap.set(id, 0));
    }

    // Tier 3: trigram title-only under-fill for any remaining slots
    const trigramIds: number[] = [];
    const trigramSlots = limit - ftsIds.length - tagOnlyIds.length;
    if (trigramSlots > 0) {
      const excludeIds = [...ftsIds, ...tagOnlyIds];
      const trigramRows = await this.prisma.post.findMany({
        where: {
          type: PostType.QUESTION,
          status: PostStatus.ACTIVE,
          ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
          title: { contains: q, mode: 'insensitive' },
        },
        orderBy: [{ upVoteCount: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
        take: trigramSlots,
      });
      trigramIds.push(...trigramRows.map((r) => r.id));
      trigramIds.forEach((id) => rankMap.set(id, -1));
    }

    return this.hydrateQuestions(
      [...ftsIds, ...tagOnlyIds, ...trigramIds],
      rankMap,
    );
  }

  private async searchAnswersFts(
    q: string,
    limit: number,
  ): Promise<SearchAnswerRow[]> {
    const ftsHits = await this.prisma.$queryRaw<FtsHit[]>`
      SELECT
        id,
        (
          ts_rank_cd(search_vector, query) * 0.6 +
          LEAST(up_vote_count, 1000)::float / 1000.0 * 0.25 +
          EXTRACT(EPOCH FROM created_at)::float /
            EXTRACT(EPOCH FROM NOW())::float * 0.15
        ) AS rank
      FROM posts, plainto_tsquery('english', ${q}) AS query
      WHERE search_vector @@ query
        AND type = 'ANSWER'
        AND status = 'ACTIVE'
        AND parent_question_id IS NOT NULL
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    const ftsIds = ftsHits.map((r) => Number(r.id));
    const rankMap = new Map<number, number>(
      ftsHits.map((r) => [Number(r.id), Number(r.rank)]),
    );

    // Body-trigram under-fill for remaining slots
    const trigramSlots = limit - ftsIds.length;
    const trigramIds: number[] = [];
    if (trigramSlots > 0) {
      const trigramRows = await this.prisma.post.findMany({
        where: {
          type: PostType.ANSWER,
          status: PostStatus.ACTIVE,
          parentQuestionId: { not: null },
          ...(ftsIds.length > 0 ? { id: { notIn: ftsIds } } : {}),
          bodyMdx: { contains: q, mode: 'insensitive' },
        },
        orderBy: [{ upVoteCount: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
        take: trigramSlots,
      });
      trigramIds.push(...trigramRows.map((r) => r.id));
      trigramIds.forEach((id) => rankMap.set(id, -1));
    }

    return this.hydrateAnswers([...ftsIds, ...trigramIds], rankMap);
  }

  // -------------------------------------------------------------------------
  // Trigram search paths (Phase 1A + Phase 3 body guardrail)
  //
  // scanBody=false: body_mdx excluded from the OR clause for short queries
  // (< 4 chars with no spaces). Scanning body_mdx via ILIKE on short tokens
  // has low signal-to-noise and hits the most expensive column.
  //
  // The tag OR branch uses tagIds from the pre-fetch (Phase 1A), giving the
  // planner a simple semi-join on question_tags.tag_id rather than a
  // correlated sub-query with a text predicate.
  // -------------------------------------------------------------------------

  private searchQuestionsTrigram(
    q: string,
    limit: number,
    tagIds: number[],
    scanBody: boolean,
  ): Promise<SearchQuestionRow[]> {
    const orClauses: Prisma.PostWhereInput[] = [
      { title: { contains: q, mode: 'insensitive' } },
    ];
    if (scanBody) {
      orClauses.push({ bodyMdx: { contains: q, mode: 'insensitive' } });
    }
    if (tagIds.length > 0) {
      orClauses.push({ questionTags: { some: { tagId: { in: tagIds } } } });
    }

    return this.prisma.post.findMany({
      where: {
        type: PostType.QUESTION,
        status: PostStatus.ACTIVE,
        OR: orClauses,
      },
      orderBy: [
        { upVoteCount: 'desc' },
        { answerCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        user: { select: { username: true, fullName: true } },
        questionTags: { select: { tag: { select: { displayName: true } } } },
      },
    }) as Promise<SearchQuestionRow[]>;
  }

  private searchAnswersTrigram(
    q: string,
    limit: number,
  ): Promise<SearchAnswerRow[]> {
    return this.prisma.post.findMany({
      where: {
        type: PostType.ANSWER,
        status: PostStatus.ACTIVE,
        parentQuestionId: { not: null },
        OR: [
          { bodyMdx: { contains: q, mode: 'insensitive' } },
          {
            parentQuestion: {
              is: { title: { contains: q, mode: 'insensitive' } },
            },
          },
        ],
      },
      orderBy: [{ upVoteCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        bodyMdx: true,
        createdAt: true,
        user: { select: { username: true, fullName: true } },
        parentQuestion: { select: { id: true, title: true } },
      },
    }) as Promise<SearchAnswerRow[]>;
  }

  private searchUsers(q: string, limit: number): Promise<SearchUserRow[]> {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ reputation: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        username: true,
        fullName: true,
        reputation: true,
      },
    }) as Promise<SearchUserRow[]>;
  }

  private searchTags(q: string, limit: number): Promise<SearchTagRow[]> {
    return this.prisma.tag.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ questionCount: 'desc' }, { displayName: 'asc' }],
      take: limit,
      select: {
        id: true,
        slug: true,
        displayName: true,
        questionCount: true,
      },
    }) as Promise<SearchTagRow[]>;
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  async searchGlobal(dto: GetGlobalSearchQueryDto) {
    const q = dto.q.trim();
    const limit = dto.limitPerType ?? 5;
    const { useFtsPosts, useTagPrefetch, useBodyGuardrail } = this.flags;

    const queryType = this.classifyQuery(q);
    const isShortPartial = queryType === 'short_partial';

    // Phase 1A: tag IDs are pre-fetched serially before the parallel queries
    // so that searchQuestionsTrigram / searchQuestionsFts can use a simple
    // tagId IN (...) semi-join instead of a nested text-predicate join.
    const tagIds = useTagPrefetch ? await this.prefetchTagIds(q) : [];

    // Route to FTS (Phase 2) for tokenised queries when the flag is on.
    // Short partial queries always use the trigram path regardless of flag.
    const isFtsActive = useFtsPosts && !isShortPartial;

    // Body guardrail (Phase 3): suppress bodyMdx from the question trigram OR
    // for short_partial queries — those tokens produce too much noise in body.
    const scanBody = !(isShortPartial && useBodyGuardrail);

    const [questions, answers, users, tags] = await Promise.all([
      isFtsActive
        ? this.searchQuestionsFts(q, limit, tagIds)
        : this.searchQuestionsTrigram(q, limit, tagIds, scanBody),
      isFtsActive
        ? this.searchAnswersFts(q, limit)
        : this.searchAnswersTrigram(q, limit),
      this.searchUsers(q, limit),
      this.searchTags(q, limit),
    ]);

    return {
      query: q,
      questions: questions.map((item) => ({
        id: String(item.id),
        title: item.title ?? 'Untitled question',
        href: `/questions/${item.id}`,
        authorName: item.user.fullName ?? item.user.username,
        createdAtLabel: this.toRelativeLabel(item.createdAt),
        tags: item.questionTags.map((tr) => tr.tag.displayName),
      })),
      answers: answers
        .filter((item) => item.parentQuestion)
        .map((item) => ({
          id: String(item.id),
          excerpt: this.snippet(item.bodyMdx, q),
          href: `/questions/${item.parentQuestion?.id}`,
          authorName: item.user.fullName ?? item.user.username,
          questionTitle: item.parentQuestion?.title ?? 'Untitled question',
          createdAtLabel: this.toRelativeLabel(item.createdAt),
        })),
      users: users.map((item) => ({
        id: String(item.id),
        username: item.username,
        displayName: item.fullName ?? item.username,
        href: `/?search=${encodeURIComponent(item.username)}&type=users`,
        reputationLabel: this.reputationLabel(item.reputation),
      })),
      tags: tags.map((item) => ({
        id: String(item.id),
        slug: item.slug,
        displayName: item.displayName,
        href: `/?search=${encodeURIComponent(item.slug)}&type=tags`,
        countLabel: `${item.questionCount}+ questions`,
      })),
    };
  }
}
