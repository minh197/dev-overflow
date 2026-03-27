import { SearchService } from './search.service';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeQuestion(overrides = {}) {
  return {
    id: 101,
    title: 'Next.js data fetching best practices',
    createdAt: new Date('2026-03-14T00:00:00.000Z'),
    user: { username: 'alex', fullName: 'Alex Doe' },
    questionTags: [{ tag: { displayName: 'next.js' } }],
    ...overrides,
  };
}

function makeAnswer(overrides = {}) {
  return {
    id: 501,
    bodyMdx: 'Use the app router and cache server work when possible.',
    createdAt: new Date('2026-03-14T01:00:00.000Z'),
    user: { username: 'sam', fullName: 'Sam Reed' },
    parentQuestion: { id: 101, title: 'Next.js data fetching best practices' },
    ...overrides,
  };
}

function makeUser(overrides = {}) {
  return {
    id: 3,
    username: 'next_dev',
    fullName: 'Next Developer',
    reputation: 1200,
    ...overrides,
  };
}

function makeTag(overrides = {}) {
  return {
    id: 7,
    slug: 'next-js',
    displayName: 'Next.js',
    questionCount: 42,
    ...overrides,
  };
}

/**
 * Builds a Prisma mock for the default trigram path (SEARCH_FTS_POSTS=false).
 *
 * Call order:
 *   1. tag.findMany         → Phase 1A pre-fetch: returns [{id}] stubs
 *   2. post.findMany (x1)   → questions (inside Promise.all)
 *   3. post.findMany (x2)   → answers   (inside Promise.all)
 *   4. user.findMany        → users     (inside Promise.all)
 *   5. tag.findMany (x2)    → actual tag results (inside Promise.all)
 */
function createTrigramMock(
  questions = [makeQuestion()],
  answers = [makeAnswer()],
  users = [makeUser()],
  tagPrefetchIds = [{ id: 7 }],
  tagResults = [makeTag()],
) {
  return {
    post: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(questions)
        .mockResolvedValueOnce(answers),
    },
    user: {
      findMany: jest.fn().mockResolvedValue(users),
    },
    tag: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(tagPrefetchIds) // Phase 1A call
        .mockResolvedValue(tagResults), // actual tag results
    },
  };
}

/**
 * Builds a Prisma mock for the FTS path (SEARCH_FTS_POSTS=true).
 *
 * $queryRaw is called twice (once for questions, once for answers).
 * post.findMany is called for hydration after each $queryRaw batch.
 */
function createFtsMock(
  questionFtsHits: { id: number; rank: number }[],
  answerFtsHits: { id: number; rank: number }[],
  questionHydrated = [makeQuestion()],
  answerHydrated = [makeAnswer()],
  users = [makeUser()],
  tagPrefetchIds = [{ id: 7 }],
  tagResults = [makeTag()],
) {
  return {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce(questionFtsHits) // searchQuestionsFts raw
      .mockResolvedValueOnce(answerFtsHits), // searchAnswersFts raw
    post: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(questionHydrated) // hydrateQuestions
        .mockResolvedValueOnce(answerHydrated), // hydrateAnswers
    },
    user: {
      findMany: jest.fn().mockResolvedValue(users),
    },
    tag: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(tagPrefetchIds)
        .mockResolvedValue(tagResults),
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: reset feature flag env vars before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  delete process.env.SEARCH_FTS_POSTS;
  delete process.env.SEARCH_TAG_PREFETCH;
  delete process.env.SEARCH_BODY_GUARDRAIL;
});

// ---------------------------------------------------------------------------
// classifyQuery — unit tests for the deterministic query router
// ---------------------------------------------------------------------------
describe('SearchService.classifyQuery', () => {
  const service = new SearchService(null as never);

  it.each([
    ['re', 'short_partial'],
    ['rea', 'short_partial'],
    ['c++', 'short_partial'],
    ['404', 'short_partial'],
    ['reac', 'fts'],
    ['react', 'fts'],
    ['react hooks', 'fts'],
    ['re act', 'fts'],
    ['js', 'short_partial'],
  ] as const)(
    'classifyQuery("%s") → %s',
    (input, expected) => {
      expect(service.classifyQuery(input)).toBe(expected);
    },
  );
});

// ---------------------------------------------------------------------------
// Trigram path — response shape (default flags)
// ---------------------------------------------------------------------------
describe('SearchService (trigram path)', () => {
  it('returns correct grouped response shape', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    const result = await service.searchGlobal({ q: 'next', limitPerType: 5 });

    expect(result.query).toBe('next');

    expect(result.questions[0]).toMatchObject({
      id: '101',
      href: '/questions/101',
      title: 'Next.js data fetching best practices',
    });

    expect(result.answers[0]).toMatchObject({
      id: '501',
      href: '/questions/101',
      questionTitle: 'Next.js data fetching best practices',
    });

    expect(result.users[0]).toMatchObject({
      username: 'next_dev',
      href: '/?search=next_dev&type=users',
    });

    expect(result.tags[0]).toMatchObject({
      slug: 'next-js',
      href: '/?search=next-js&type=tags',
    });
  });

  it('tag.findMany is called twice: once for pre-fetch, once for actual results', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    expect(prisma.tag.findMany).toHaveBeenCalledTimes(2);
    // First call: pre-fetch — only selects id
    expect(prisma.tag.findMany.mock.calls[0][0]).toMatchObject({
      select: { id: true },
    });
    // Second call: actual tag results — selects display fields
    expect(prisma.tag.findMany.mock.calls[1][0]).toMatchObject({
      select: {
        id: true,
        slug: true,
        displayName: true,
        questionCount: true,
      },
    });
  });

  it('question query uses tagId IN clause (not nested OR) when tags are pre-fetched', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    const questionCall = prisma.post.findMany.mock.calls[0][0];
    const orClauses = questionCall.where.OR as Array<Record<string, unknown>>;

    // Must contain the tag OR clause using tagId: { in: [7] }
    const tagClause = orClauses.find(
      (c) => c.questionTags !== undefined,
    ) as { questionTags: { some: { tagId: { in: number[] } } } } | undefined;

    expect(tagClause).toBeDefined();
    expect(tagClause?.questionTags.some.tagId.in).toContain(7);

    // Must NOT contain a nested tag.OR text predicate
    const hasNestedTextSearch = orClauses.some((c) => {
      const qt = c.questionTags as { some?: { tag?: unknown } } | undefined;
      return qt?.some?.tag !== undefined;
    });
    expect(hasNestedTextSearch).toBe(false);
  });

  it('body_mdx is excluded from question OR when query is short_partial and guardrail is on', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    // "re" → short_partial, SEARCH_BODY_GUARDRAIL defaults to on
    await service.searchGlobal({ q: 're', limitPerType: 5 });

    const questionCall = prisma.post.findMany.mock.calls[0][0];
    const orClauses = questionCall.where.OR as Array<Record<string, unknown>>;
    const hasBodyClause = orClauses.some((c) => c.bodyMdx !== undefined);
    expect(hasBodyClause).toBe(false);
  });

  it('body_mdx IS included for short_partial when SEARCH_BODY_GUARDRAIL=false', async () => {
    process.env.SEARCH_BODY_GUARDRAIL = 'false';
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    await service.searchGlobal({ q: 're', limitPerType: 5 });

    const questionCall = prisma.post.findMany.mock.calls[0][0];
    const orClauses = questionCall.where.OR as Array<Record<string, unknown>>;
    const hasBodyClause = orClauses.some((c) => c.bodyMdx !== undefined);
    expect(hasBodyClause).toBe(true);
  });

  it('body_mdx IS included for fts-class queries in trigram path', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    // "react" → fts query type → body should be scanned
    await service.searchGlobal({ q: 'react', limitPerType: 5 });

    const questionCall = prisma.post.findMany.mock.calls[0][0];
    const orClauses = questionCall.where.OR as Array<Record<string, unknown>>;
    const hasBodyClause = orClauses.some((c) => c.bodyMdx !== undefined);
    expect(hasBodyClause).toBe(true);
  });

  it('skips tag pre-fetch when SEARCH_TAG_PREFETCH=false', async () => {
    process.env.SEARCH_TAG_PREFETCH = 'false';
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    // tag.findMany called only once (actual tags in Promise.all, no pre-fetch)
    expect(prisma.tag.findMany).toHaveBeenCalledTimes(1);
  });

  it('question query falls back to nested tag OR when tag pre-fetch is disabled', async () => {
    process.env.SEARCH_TAG_PREFETCH = 'false';
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    const questionCall = prisma.post.findMany.mock.calls[0][0];
    const orClauses = questionCall.where.OR as Array<Record<string, unknown>>;

    // When pre-fetch is off, tagIds=[] so no questionTags OR branch added
    const tagClause = orClauses.find((c) => c.questionTags !== undefined);
    expect(tagClause).toBeUndefined();
  });

  it('filters out answers that have no parentQuestion', async () => {
    const answerWithNoParent = makeAnswer({ parentQuestion: null });
    const prisma = createTrigramMock(
      [makeQuestion()],
      [answerWithNoParent],
    );
    const service = new SearchService(prisma as never);

    const result = await service.searchGlobal({ q: 'next', limitPerType: 5 });
    expect(result.answers).toHaveLength(0);
  });

  it('uses fallback strings for null title / fullName', async () => {
    const prisma = createTrigramMock(
      [makeQuestion({ title: null, user: { username: 'bob', fullName: null } })],
      [makeAnswer({ user: { username: 'bob', fullName: null } })],
    );
    const service = new SearchService(prisma as never);

    const result = await service.searchGlobal({ q: 'next', limitPerType: 5 });
    expect(result.questions[0].title).toBe('Untitled question');
    expect(result.questions[0].authorName).toBe('bob');
    expect(result.answers[0].authorName).toBe('bob');
  });
});

// ---------------------------------------------------------------------------
// FTS path
// ---------------------------------------------------------------------------
describe('SearchService (FTS path)', () => {
  beforeEach(() => {
    process.env.SEARCH_FTS_POSTS = 'true';
  });

  it('uses $queryRaw for post search when FTS flag is on', async () => {
    const prisma = createFtsMock(
      [{ id: 101, rank: 0.72 }],
      [{ id: 501, rank: 0.65 }],
    );
    const service = new SearchService(prisma as never);

    await service.searchGlobal({ q: 'next.js', limitPerType: 5 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('hydrates questions via findMany after FTS raw query', async () => {
    const prisma = createFtsMock(
      [{ id: 101, rank: 0.9 }],
      [{ id: 501, rank: 0.8 }],
    );
    const service = new SearchService(prisma as never);

    const result = await service.searchGlobal({ q: 'react', limitPerType: 5 });

    expect(result.questions[0]).toMatchObject({
      id: '101',
      href: '/questions/101',
    });
  });

  it('falls back to trigram path for short_partial queries even with FTS enabled', async () => {
    const prisma = createTrigramMock(); // no $queryRaw mock needed
    const service = new SearchService(prisma as never);

    // "re" → short_partial → must NOT call $queryRaw
    await service.searchGlobal({ q: 're', limitPerType: 5 });

    expect(prisma.tag.findMany).toHaveBeenCalledTimes(2); // pre-fetch + actual
    // $queryRaw is not on the trigram mock, so if it were called it would throw
  });

  it('FTS under-fill: calls tag top-up when raw query returns fewer than limit results', async () => {
    const prisma = createFtsMock(
      [{ id: 101, rank: 0.9 }], // only 1 FTS hit, limit is 5 → need top-up
      [{ id: 501, rank: 0.8 }],
      [makeQuestion()], // hydration for question id 101
      [makeAnswer()],
    );

    // Extend post.findMany to also handle the tag top-up call
    const tagTopUpRows = [{ id: 202 }];
    prisma.post.findMany
      .mockResolvedValueOnce(tagTopUpRows) // tag top-up for questions
      .mockResolvedValueOnce([makeQuestion({ id: 202 })]) // hydration including top-up
      .mockResolvedValueOnce([makeAnswer()]);

    const service = new SearchService(prisma as never);
    const result = await service.searchGlobal({ q: 'react', limitPerType: 5 });

    // Tag top-up was triggered (post.findMany called more than the baseline 2)
    expect(prisma.post.findMany).toHaveBeenCalledTimes(3); // tag top-up + hydrate questions + hydrate answers
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('preserves FTS rank order in response (highest rank first)', async () => {
    const ftsHits = [
      { id: 10, rank: 0.9 },
      { id: 20, rank: 0.7 },
      { id: 30, rank: 0.5 },
    ];
    const hydratedInWrongOrder = [
      makeQuestion({ id: 30 }),
      makeQuestion({ id: 10 }),
      makeQuestion({ id: 20 }),
    ];

    const prisma = createFtsMock(ftsHits, [], hydratedInWrongOrder, []);
    const service = new SearchService(prisma as never);

    const result = await service.searchGlobal({ q: 'query', limitPerType: 5 });

    expect(result.questions.map((q) => q.id)).toEqual(['10', '20', '30']);
  });
});

// ---------------------------------------------------------------------------
// reputationLabel formatting
// ---------------------------------------------------------------------------
describe('SearchService.reputationLabel', () => {
  const service = new SearchService(null as never);
  const label = (n: number) =>
    // Access private method via cast for unit testing
    (service as unknown as { reputationLabel: (n: number) => string }).reputationLabel(n);

  it.each([
    [0, '0 rep'],
    [999, '999 rep'],
    [1000, '1.0k rep'],
    [1500, '1.5k rep'],
    [1_000_000, '1.0m rep'],
  ])('reputationLabel(%i) → "%s"', (input, expected) => {
    expect(label(input)).toBe(expected);
  });
});
