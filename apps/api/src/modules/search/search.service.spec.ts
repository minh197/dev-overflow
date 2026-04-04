import { SearchService } from './search.service';

type TagFindManyCallArgs = {
  select?: Record<string, boolean>;
};

type PostFindManyCallArgs = {
  where: { OR: Array<Record<string, unknown>> };
};

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
type CreateFtsMockOptions = {
  /** Extra question IDs returned from tag semi-join top-up */
  questionTagTopUp?: { id: number }[];
  questionTrigram?: { id: number }[];
  answerTrigram?: { id: number }[];
};

function createFtsMock(
  questionFtsHits: { id: number; rank: number }[],
  answerFtsHits: { id: number; rank: number }[],
  questionHydrated = [makeQuestion()],
  answerHydrated = [makeAnswer()],
  users = [makeUser()],
  tagPrefetchIds = [{ id: 7 }],
  tagResults = [makeTag()],
  options: CreateFtsMockOptions = {},
) {
  return {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce(questionFtsHits) // searchQuestionsFts raw
      .mockResolvedValueOnce(answerFtsHits), // searchAnswersFts raw
    post: {
      findMany: jest
        .fn()
        .mockImplementation(
          (args: {
            where?: {
              id?: { in?: number[] };
              questionTags?: unknown;
              title?: unknown;
              bodyMdx?: unknown;
            };
            select?: Record<string, unknown>;
          }) => {
            const w = args.where ?? {};
            const s = args.select ?? {};

            if (w.id?.in) {
              if (s.parentQuestion != null) {
                return Promise.resolve(answerHydrated);
              }
              return Promise.resolve(questionHydrated);
            }
            if (w.questionTags) {
              return Promise.resolve(options.questionTagTopUp ?? []);
            }
            if (w.title) {
              return Promise.resolve(options.questionTrigram ?? []);
            }
            if (w.bodyMdx) {
              return Promise.resolve(options.answerTrigram ?? []);
            }
            return Promise.resolve([]);
          },
        ),
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
  delete process.env.SEARCH_ENGINE;
  delete process.env.SEARCH_TYPESENSE_FALLBACK;
});

// ---------------------------------------------------------------------------
// classifyQuery — unit tests for the deterministic query router
// ---------------------------------------------------------------------------
describe('SearchService.classifyQuery', () => {
  const service = new SearchService(null as never, null);

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
  ] as const)('classifyQuery("%s") → %s', (input, expected) => {
    expect(service.classifyQuery(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Trigram path — response shape (default flags)
// ---------------------------------------------------------------------------
describe('SearchService (trigram path)', () => {
  it('returns correct grouped response shape', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never, null);

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
    const service = new SearchService(prisma as never, null);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    expect(prisma.tag.findMany).toHaveBeenCalledTimes(2);
    const tagCalls = prisma.tag.findMany.mock.calls as Array<
      [TagFindManyCallArgs]
    >;
    // First call: pre-fetch — only selects id
    expect(tagCalls[0][0]).toMatchObject({
      select: { id: true },
    });
    // Second call: actual tag results — selects display fields
    expect(tagCalls[1][0]).toMatchObject({
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
    const service = new SearchService(prisma as never, null);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    const postCalls = prisma.post.findMany.mock.calls as Array<
      [PostFindManyCallArgs]
    >;
    const questionCall = postCalls[0][0];
    const orClauses = questionCall.where.OR;

    // Must contain the tag OR clause using tagId: { in: [7] }
    const tagClause = orClauses.find((c) => c.questionTags !== undefined) as
      | { questionTags: { some: { tagId: { in: number[] } } } }
      | undefined;

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
    const service = new SearchService(prisma as never, null);

    // "re" → short_partial, SEARCH_BODY_GUARDRAIL defaults to on
    await service.searchGlobal({ q: 're', limitPerType: 5 });

    const postCalls = prisma.post.findMany.mock.calls as Array<
      [PostFindManyCallArgs]
    >;
    const questionCall = postCalls[0][0];
    const orClauses = questionCall.where.OR;
    const hasBodyClause = orClauses.some((c) => c.bodyMdx !== undefined);
    expect(hasBodyClause).toBe(false);
  });

  it('body_mdx IS included for short_partial when SEARCH_BODY_GUARDRAIL=false', async () => {
    process.env.SEARCH_BODY_GUARDRAIL = 'false';
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never, null);

    await service.searchGlobal({ q: 're', limitPerType: 5 });

    const postCalls = prisma.post.findMany.mock.calls as Array<
      [PostFindManyCallArgs]
    >;
    const questionCall = postCalls[0][0];
    const orClauses = questionCall.where.OR;
    const hasBodyClause = orClauses.some((c) => c.bodyMdx !== undefined);
    expect(hasBodyClause).toBe(true);
  });

  it('body_mdx IS included for fts-class queries in trigram path', async () => {
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never, null);

    // "react" → fts query type → body should be scanned
    await service.searchGlobal({ q: 'react', limitPerType: 5 });

    const postCalls = prisma.post.findMany.mock.calls as Array<
      [PostFindManyCallArgs]
    >;
    const questionCall = postCalls[0][0];
    const orClauses = questionCall.where.OR;
    const hasBodyClause = orClauses.some((c) => c.bodyMdx !== undefined);
    expect(hasBodyClause).toBe(true);
  });

  it('skips tag pre-fetch when SEARCH_TAG_PREFETCH=false', async () => {
    process.env.SEARCH_TAG_PREFETCH = 'false';
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never, null);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    // tag.findMany called only once (actual tags in Promise.all, no pre-fetch)
    expect(prisma.tag.findMany).toHaveBeenCalledTimes(1);
  });

  it('question query falls back to nested tag OR when tag pre-fetch is disabled', async () => {
    process.env.SEARCH_TAG_PREFETCH = 'false';
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never, null);

    await service.searchGlobal({ q: 'next', limitPerType: 5 });

    const postCalls = prisma.post.findMany.mock.calls as Array<
      [PostFindManyCallArgs]
    >;
    const questionCall = postCalls[0][0];
    const orClauses = questionCall.where.OR;

    // When pre-fetch is off, tagIds=[] so no questionTags OR branch added
    const tagClause = orClauses.find((c) => c.questionTags !== undefined);
    expect(tagClause).toBeUndefined();
  });

  it('filters out answers that have no parentQuestion', async () => {
    const answerWithNoParent = makeAnswer({ parentQuestion: null });
    const prisma = createTrigramMock([makeQuestion()], [answerWithNoParent]);
    const service = new SearchService(prisma as never, null);

    const result = await service.searchGlobal({ q: 'next', limitPerType: 5 });
    expect(result.answers).toHaveLength(0);
  });

  it('uses fallback strings for null title / fullName', async () => {
    const prisma = createTrigramMock(
      [
        makeQuestion({
          title: null,
          user: { username: 'bob', fullName: null },
        }),
      ],
      [makeAnswer({ user: { username: 'bob', fullName: null } })],
    );
    const service = new SearchService(prisma as never, null);

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
    const service = new SearchService(prisma as never, null);

    await service.searchGlobal({ q: 'next.js', limitPerType: 5 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('hydrates questions via findMany after FTS raw query', async () => {
    const prisma = createFtsMock(
      [{ id: 101, rank: 0.9 }],
      [{ id: 501, rank: 0.8 }],
    );
    const service = new SearchService(prisma as never, null);

    const result = await service.searchGlobal({ q: 'react', limitPerType: 5 });

    expect(result.questions[0]).toMatchObject({
      id: '101',
      href: '/questions/101',
    });
  });

  it('falls back to trigram path for short_partial queries even with FTS enabled', async () => {
    const prisma = createTrigramMock(); // no $queryRaw mock needed
    const service = new SearchService(prisma as never, null);

    // "re" → short_partial → must NOT call $queryRaw
    await service.searchGlobal({ q: 're', limitPerType: 5 });

    expect(prisma.tag.findMany).toHaveBeenCalledTimes(2); // pre-fetch + actual
    // $queryRaw is not on the trigram mock, so if it were called it would throw
  });

  it('FTS under-fill: calls tag top-up when raw query returns fewer than limit results', async () => {
    const tagTopUpRows = [{ id: 202 }];
    const prisma = createFtsMock(
      [{ id: 101, rank: 0.9 }], // only 1 FTS hit, limit is 5 → need top-up
      [{ id: 501, rank: 0.8 }],
      [makeQuestion(), makeQuestion({ id: 202, title: 'Tag top-up row' })],
      [makeAnswer()],
      [makeUser()],
      [{ id: 7 }],
      [makeTag()],
      { questionTagTopUp: tagTopUpRows },
    );

    const service = new SearchService(prisma as never, null);
    const result = await service.searchGlobal({ q: 'react', limitPerType: 5 });

    expect(prisma.post.findMany.mock.calls.length).toBeGreaterThanOrEqual(3);
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
    const service = new SearchService(prisma as never, null);

    const result = await service.searchGlobal({ q: 'query', limitPerType: 5 });

    expect(result.questions.map((q) => q.id)).toEqual(['10', '20', '30']);
  });
});

// ---------------------------------------------------------------------------
// Typesense path
// ---------------------------------------------------------------------------
describe('SearchService (Typesense)', () => {
  it('maps multi_search results to GlobalSearchResponse shape', async () => {
    process.env.SEARCH_ENGINE = 'typesense';

    const created = new Date('2026-03-14T12:00:00.000Z').getTime();
    const mockTs = {
      multiSearch: {
        perform: jest.fn().mockResolvedValue({
          results: [
            {
              hits: [
                {
                  document: {
                    id: '101',
                    title: 'Sample question',
                    tag_display_names: ['nestjs'],
                    author_username: 'alex',
                    author_full_name: 'Alex Doe',
                    created_at: created,
                  },
                },
              ],
            },
            {
              hits: [
                {
                  document: {
                    id: '501',
                    body_mdx: 'Try using cache.',
                    parent_question_id: 101,
                    parent_title: 'Sample question',
                    author_username: 'sam',
                    author_full_name: null,
                    created_at: created,
                  },
                },
              ],
            },
            {
              hits: [
                {
                  document: {
                    id: '3',
                    username: 'dev',
                    full_name: 'Dev User',
                    reputation: 500,
                  },
                },
              ],
            },
            {
              hits: [
                {
                  document: {
                    id: '7',
                    slug: 'nestjs',
                    display_name: 'NestJS',
                    question_count: 10,
                  },
                },
              ],
            },
          ],
        }),
      },
    };

    const prisma = createTrigramMock([], [], [], [], []);
    const service = new SearchService(prisma as never, mockTs as never);

    const result = await service.searchGlobal({ q: 'sample', limitPerType: 5 });

    expect(mockTs.multiSearch.perform).toHaveBeenCalledWith(
      expect.objectContaining({
        searches: expect.arrayContaining([
          expect.objectContaining({
            collection: 'search_questions',
            q: 'sample',
          }),
        ]),
      }),
    );

    expect(result.query).toBe('sample');
    expect(result.questions[0]).toMatchObject({
      id: '101',
      title: 'Sample question',
      href: '/questions/101',
      tags: ['nestjs'],
    });
    expect(result.answers[0]).toMatchObject({
      id: '501',
      href: '/questions/101',
      questionTitle: 'Sample question',
    });
    expect(result.users[0]).toMatchObject({
      id: '3',
      username: 'dev',
      displayName: 'Dev User',
    });
    expect(result.tags[0]).toMatchObject({
      id: '7',
      slug: 'nestjs',
      countLabel: '10+ questions',
    });
  });

  it('falls back to Postgres when Typesense throws and SEARCH_TYPESENSE_FALLBACK=true', async () => {
    process.env.SEARCH_ENGINE = 'typesense';
    process.env.SEARCH_TYPESENSE_FALLBACK = 'true';

    const mockTs = {
      multiSearch: {
        perform: jest.fn().mockRejectedValue(new Error('typesense down')),
      },
    };
    const prisma = createTrigramMock();
    const service = new SearchService(prisma as never, mockTs as never);

    const result = await service.searchGlobal({ q: 'next', limitPerType: 5 });

    expect(result.query).toBe('next');
    expect(result.questions[0]?.title).toBe(
      'Next.js data fetching best practices',
    );
  });
});

// ---------------------------------------------------------------------------
// reputationLabel formatting
// ---------------------------------------------------------------------------
describe('SearchService.reputationLabel', () => {
  const service = new SearchService(null as never, null);
  const label = (n: number) =>
    // Access private method via cast for unit testing
    (
      service as unknown as { reputationLabel: (n: number) => string }
    ).reputationLabel(n);

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
