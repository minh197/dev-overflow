/**
 * Recreates Typesense search collections and bulk-imports from Postgres.
 * Requires DATABASE_URL + Typesense env (see .env.example).
 *
 * Usage (from repo root): npm run reindex:search --workspace=api
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient, PostType, UserStatus } from '@prisma/client';
import { createTypesenseClientFromEnv } from '../src/modules/search/search-index.service';
import {
  ALL_SEARCH_COLLECTION_SCHEMAS,
  SEARCH_COLLECTION_ANSWERS,
  SEARCH_COLLECTION_QUESTIONS,
  SEARCH_COLLECTION_TAGS,
  SEARCH_COLLECTION_USERS,
} from '../src/modules/search/typesense.collections';

config({ path: resolve(process.cwd(), '../../.env') });
config();

async function recreateCollections(
  client: ReturnType<typeof createTypesenseClientFromEnv>,
) {
  if (!client) return;

  for (const schema of ALL_SEARCH_COLLECTION_SCHEMAS) {
    try {
      await client.collections(schema.name).delete();
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'httpStatus' in e
          ? (e as { httpStatus?: number }).httpStatus
          : undefined;
      if (status !== 404) {
        throw e;
      }
    }
    await client.collections().create(schema);
  }
}

async function main() {
  const ts = createTypesenseClientFromEnv();
  if (!ts) {
    console.error(
      'Missing Typesense configuration. Set TYPESENSE_HOST and TYPESENSE_API_KEY.',
    );
    process.exit(1);
  }

  await recreateCollections(ts);

  const prisma = new PrismaClient();

  const questions = await prisma.post.findMany({
    where: { type: PostType.QUESTION },
    select: {
      id: true,
      title: true,
      bodyMdx: true,
      upVoteCount: true,
      createdAt: true,
      status: true,
      user: { select: { username: true, fullName: true } },
      questionTags: {
        select: { tag: { select: { displayName: true } } },
      },
    },
  });

  const answers = await prisma.post.findMany({
    where: { type: PostType.ANSWER },
    select: {
      id: true,
      bodyMdx: true,
      parentQuestionId: true,
      upVoteCount: true,
      createdAt: true,
      status: true,
      user: { select: { username: true, fullName: true } },
      parentQuestion: { select: { title: true } },
    },
  });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      reputation: true,
      status: true,
    },
  });

  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      slug: true,
      displayName: true,
      questionCount: true,
    },
  });

  const qDocs = questions.map((p) => ({
    id: String(p.id),
    title: p.title ?? '',
    body_mdx: p.bodyMdx,
    tag_display_names: p.questionTags.map((qt) => qt.tag.displayName),
    author_username: p.user.username,
    author_full_name: p.user.fullName ?? undefined,
    up_vote_count: p.upVoteCount,
    created_at: p.createdAt.getTime(),
    status: p.status,
  }));

  const aDocs = answers
    .filter((p) => p.parentQuestionId != null && p.parentQuestion)
    .map((p) => ({
      id: String(p.id),
      body_mdx: p.bodyMdx,
      parent_question_id: p.parentQuestionId!,
      parent_title: p.parentQuestion?.title ?? '',
      author_username: p.user.username,
      author_full_name: p.user.fullName ?? undefined,
      up_vote_count: p.upVoteCount,
      created_at: p.createdAt.getTime(),
      status: p.status,
    }));

  const uDocs = users
    .filter((u) => u.status === UserStatus.ACTIVE)
    .map((u) => ({
      id: String(u.id),
      username: u.username,
      full_name: u.fullName ?? undefined,
      reputation: u.reputation,
      status: u.status,
    }));

  const tDocs = tags.map((t) => ({
    id: String(t.id),
    slug: t.slug,
    display_name: t.displayName,
    question_count: t.questionCount,
  }));

  const batchSize = 200;

  async function importBatches(
    collectionName: string,
    docs: Record<string, unknown>[],
  ) {
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      if (chunk.length === 0) continue;
      const res = await ts
        .collections(collectionName)
        .documents()
        .import(chunk, { action: 'upsert' });
      const arr = Array.isArray(res) ? res : [];
      const failures = arr.filter(
        (r: { success?: boolean }) => r.success === false,
      );
      if (failures.length > 0) {
        console.error(collectionName, 'import failures', failures.slice(0, 3));
        throw new Error(`Typesense import had ${failures.length} failures`);
      }
    }
  }

  await importBatches(SEARCH_COLLECTION_QUESTIONS, qDocs);
  await importBatches(SEARCH_COLLECTION_ANSWERS, aDocs);
  await importBatches(SEARCH_COLLECTION_USERS, uDocs);
  await importBatches(SEARCH_COLLECTION_TAGS, tDocs);

  await prisma.$disconnect();

  console.log(
    `Indexed ${qDocs.length} questions, ${aDocs.length} answers, ${uDocs.length} users, ${tDocs.length} tags.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
