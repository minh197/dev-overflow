import { SearchService } from './search.service';

describe('SearchService', () => {
  function createPrismaMock() {
    return {
      post: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 101,
              title: 'Next.js data fetching best practices',
              createdAt: new Date('2026-03-14T00:00:00.000Z'),
              user: { username: 'alex', fullName: 'Alex Doe' },
              questionTags: [{ tag: { displayName: 'next.js' } }],
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 501,
              bodyMdx: 'Use the app router and cache server work when possible.',
              createdAt: new Date('2026-03-14T01:00:00.000Z'),
              user: { username: 'sam', fullName: 'Sam Reed' },
              parentQuestion: {
                id: 101,
                title: 'Next.js data fetching best practices',
              },
            },
          ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            username: 'next_dev',
            fullName: 'Next Developer',
            reputation: 1200,
          },
        ]),
      },
      tag: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7,
            slug: 'next-js',
            displayName: 'Next.js',
            questionCount: 42,
          },
        ]),
      },
    };
  }

  it('returns grouped search results for the global dropdown', async () => {
    const prisma = createPrismaMock();
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
});
