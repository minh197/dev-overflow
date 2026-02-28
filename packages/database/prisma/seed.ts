import { PostStatus, PostType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const usersSeed = [
  {
    email: 'seed.alex@devoverflow.dev',
    username: 'seed_alex',
    fullName: 'Alex Tran',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Alex',
  },
  {
    email: 'seed.mina@devoverflow.dev',
    username: 'seed_mina',
    fullName: 'Mina Nguyen',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Mina',
  },
  {
    email: 'seed.ravi@devoverflow.dev',
    username: 'seed_ravi',
    fullName: 'Ravi Patel',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Ravi',
  },
  {
    email: 'seed.sophia@devoverflow.dev',
    username: 'seed_sophia',
    fullName: 'Sophia Lee',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Sophia',
  },
];

const tagsSeed = [
  { slug: 'javascript', displayName: 'javascript' },
  { slug: 'typescript', displayName: 'typescript' },
  { slug: 'reactjs', displayName: 'reactjs' },
  { slug: 'next-js', displayName: 'next.js' },
  { slug: 'nestjs', displayName: 'nestjs' },
  { slug: 'postgresql', displayName: 'postgresql' },
  { slug: 'prisma', displayName: 'prisma' },
  { slug: 'html', displayName: 'html' },
  { slug: 'css', displayName: 'css' },
  { slug: 'mysql', displayName: 'mysql' },
];

const questionSeed = [
  {
    authorUsername: 'seed_alex',
    title:
      'How can I avoid hydration mismatch when rendering theme-dependent UI in Next.js?',
    bodyMdx: 'I am seeing hydration mismatch warnings for dark mode toggles.',
    upVoteCount: 84,
    viewCount: 1540,
    answerCount: 3,
    hoursAgo: 1,
    tagSlugs: ['next-js', 'reactjs', 'typescript'],
  },
  {
    authorUsername: 'seed_mina',
    title:
      'Best approach to implement cursor pagination with Prisma for a questions feed?',
    bodyMdx: 'I need stable ordering under concurrent inserts.',
    upVoteCount: 69,
    viewCount: 1200,
    answerCount: 2,
    hoursAgo: 2,
    tagSlugs: ['prisma', 'postgresql', 'typescript'],
  },
  {
    authorUsername: 'seed_ravi',
    title: 'Why does my NestJS provider fail with dependency resolution error?',
    bodyMdx: 'The service cannot resolve PrismaService in a feature module.',
    upVoteCount: 51,
    viewCount: 980,
    answerCount: 1,
    hoursAgo: 3,
    tagSlugs: ['nestjs', 'typescript'],
  },
  {
    authorUsername: 'seed_sophia',
    title: 'How to optimize SQL ordering for recommended and frequent tabs?',
    bodyMdx: 'Need deterministic ordering and fast response time.',
    upVoteCount: 105,
    viewCount: 2300,
    answerCount: 4,
    hoursAgo: 6,
    tagSlugs: ['postgresql', 'prisma'],
  },
  {
    authorUsername: 'seed_alex',
    title:
      'HTML table where values come from adjacent Google Sheet cells keeps breaking',
    bodyMdx: 'Need reliable parsing and alignment in generated table rows.',
    upVoteCount: 22,
    viewCount: 790,
    answerCount: 0,
    hoursAgo: 8,
    tagSlugs: ['html', 'javascript'],
  },
  {
    authorUsername: 'seed_mina',
    title:
      'Form validation prevents submit to mysql after adding custom JS constraints',
    bodyMdx: 'Submit handler exits early and data never reaches backend.',
    upVoteCount: 18,
    viewCount: 620,
    answerCount: 0,
    hoursAgo: 12,
    tagSlugs: ['javascript', 'mysql', 'html'],
  },
  {
    authorUsername: 'seed_ravi',
    title:
      'How to model question tags in Prisma without causing N+1 queries in feed?',
    bodyMdx: 'Need a single-query or efficient two-query strategy.',
    upVoteCount: 76,
    viewCount: 1460,
    answerCount: 2,
    hoursAgo: 16,
    tagSlugs: ['prisma', 'postgresql', 'nestjs'],
  },
  {
    authorUsername: 'seed_sophia',
    title:
      'Should I denormalize answerCount and viewCount on posts for homepage performance?',
    bodyMdx: 'I am considering counters to avoid expensive aggregates.',
    upVoteCount: 91,
    viewCount: 1775,
    answerCount: 5,
    hoursAgo: 20,
    tagSlugs: ['postgresql', 'nestjs'],
  },
  {
    authorUsername: 'seed_alex',
    title:
      'How to style a three-column dark dashboard layout similar to Stack Overflow?',
    bodyMdx: 'Need responsive behavior and consistent card spacing.',
    upVoteCount: 33,
    viewCount: 840,
    answerCount: 1,
    hoursAgo: 24,
    tagSlugs: ['css', 'reactjs', 'next-js'],
  },
  {
    authorUsername: 'seed_mina',
    title: 'Recommended feed ranking feels random when votes tie',
    bodyMdx: 'What tie-breakers should I use for deterministic ordering?',
    upVoteCount: 57,
    viewCount: 1320,
    answerCount: 2,
    hoursAgo: 30,
    tagSlugs: ['postgresql', 'typescript'],
  },
  {
    authorUsername: 'seed_ravi',
    title: 'Unanswered tab should hide posts with accepted answers only or all answers?',
    bodyMdx: 'Looking for best product behavior and SQL filter.',
    upVoteCount: 14,
    viewCount: 410,
    answerCount: 0,
    hoursAgo: 36,
    tagSlugs: ['nestjs', 'postgresql'],
  },
  {
    authorUsername: 'seed_sophia',
    title:
      'Global search endpoint: grouped results by questions, tags, users with type chips',
    bodyMdx: 'How should API payload be structured for dropdown rendering?',
    upVoteCount: 63,
    viewCount: 1388,
    answerCount: 3,
    hoursAgo: 48,
    tagSlugs: ['nestjs', 'next-js', 'typescript'],
  },
];

async function main() {
  const now = new Date('2026-03-01T12:00:00.000Z');

  // FK-safe reset to keep repeated runs deterministic.
  await prisma.questionTag.deleteMany({});
  await prisma.aiAnswer.deleteMany({});
  await prisma.answer.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.bookmark.deleteMany({});
  await prisma.postView.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.user.deleteMany({});

  await prisma.user.createMany({ data: usersSeed });
  await prisma.tag.createMany({ data: tagsSeed });

  const users = await prisma.user.findMany({
    where: { username: { in: usersSeed.map((u) => u.username) } },
  });
  const tags = await prisma.tag.findMany({
    where: { slug: { in: tagsSeed.map((t) => t.slug) } },
  });

  const userIdByUsername = new Map(users.map((user) => [user.username, user.id]));
  const tagIdBySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));

  for (let i = 0; i < questionSeed.length; i += 1) {
    const item = questionSeed[i];
    const userId = userIdByUsername.get(item.authorUsername);
    if (!userId) {
      throw new Error(`Missing user for username "${item.authorUsername}"`);
    }

    const createdAt = new Date(now.getTime() - item.hoursAgo * 60 * 60 * 1000);
    const post = await prisma.post.create({
      data: {
        uuid: `seed-home-q-${String(i + 1).padStart(2, '0')}`,
        userId,
        title: item.title,
        bodyMdx: item.bodyMdx,
        type: PostType.QUESTION,
        status: PostStatus.ACTIVE,
        upVoteCount: item.upVoteCount,
        downVoteCount: 0,
        viewCount: item.viewCount,
        answerCount: item.answerCount,
        createdAt,
        updatedAt: createdAt,
      },
    });

    const question = await prisma.question.create({
      data: {
        postId: post.id,
        createdAt,
        updatedAt: createdAt,
      },
    });

    const questionTagRows = item.tagSlugs.map((slug) => {
      const tagId = tagIdBySlug.get(slug);
      if (!tagId) {
        throw new Error(`Missing tag for slug "${slug}"`);
      }
      return { questionId: question.id, tagId, createdAt };
    });

    await prisma.questionTag.createMany({
      data: questionTagRows,
      skipDuplicates: true,
    });
  }

  const tagUsage = await prisma.questionTag.groupBy({
    by: ['tagId'],
    _count: { tagId: true },
  });
  const usageCountByTagId = new Map(
    tagUsage.map((row) => [row.tagId, row._count.tagId]),
  );

  await Promise.all(
    tags.map((tag) =>
      prisma.tag.update({
        where: { id: tag.id },
        data: { questionCount: usageCountByTagId.get(tag.id) ?? 0 },
      }),
    ),
  );

  const totals = await Promise.all([
    prisma.user.count(),
    prisma.tag.count(),
    prisma.post.count({ where: { type: PostType.QUESTION } }),
    prisma.question.count(),
    prisma.questionTag.count(),
  ]);

  console.log('Seed complete.');
  console.log(`users=${totals[0]} tags=${totals[1]} questionPosts=${totals[2]}`);
  console.log(`questions=${totals[3]} questionTags=${totals[4]}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
