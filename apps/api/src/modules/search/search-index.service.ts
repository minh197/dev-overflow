import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { PostStatus, PostType, UserStatus } from '@prisma/client';
import Typesense, { type Client } from 'typesense';
import { PrismaService } from '../../prisma/prisma.service';
import { getTypesenseConfigurationOptions } from './search-env';
import {
  SEARCH_COLLECTION_ANSWERS,
  SEARCH_COLLECTION_QUESTIONS,
  SEARCH_COLLECTION_TAGS,
  SEARCH_COLLECTION_USERS,
} from './typesense.collections';
import { TYPESENSE_CLIENT } from './typesense.constants';

@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(TYPESENSE_CLIENT) private readonly typesense: Client | null,
  ) {}

  private get client(): Client | null {
    if (this.typesense) return this.typesense;
    return null;
  }

  /** True when Typesense client is wired (env had host + API key). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Fire-and-forget safe wrapper for HTTP sync. */
  private run(task: () => Promise<void>, label: string): void {
    if (!this.client) return;
    void task().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Search index sync failed (${label}): ${message}`);
    });
  }

  syncQuestionById(postId: number): void {
    this.run(() => this.upsertQuestion(postId), `question:${postId}`);
  }

  removeQuestionDocument(postId: number): void {
    this.run(async () => {
      if (!this.client) return;
      try {
        await this.client
          .collections(SEARCH_COLLECTION_QUESTIONS)
          .documents(String(postId))
          .delete();
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'httpStatus' in e ? (e as { httpStatus?: number }).httpStatus : undefined;
        if (msg === 404) return;
        throw e;
      }
    }, `delete-question:${postId}`);
  }

  deleteAnswersForQuestion(parentQuestionId: number): void {
    this.run(async () => {
      if (!this.client) return;
      await this.client
        .collections(SEARCH_COLLECTION_ANSWERS)
        .documents()
        .delete({
          filter_by: `parent_question_id:${parentQuestionId}`,
        });
    }, `delete-answers-for:${parentQuestionId}`);
  }

  syncAnswerById(answerPostId: number): void {
    this.run(() => this.upsertAnswer(answerPostId), `answer:${answerPostId}`);
  }

  removeAnswerDocument(answerPostId: number): void {
    this.run(async () => {
      if (!this.client) return;
      try {
        await this.client
          .collections(SEARCH_COLLECTION_ANSWERS)
          .documents(String(answerPostId))
          .delete();
      } catch (e: unknown) {
        const status =
          e && typeof e === 'object' && 'httpStatus' in e
            ? (e as { httpStatus?: number }).httpStatus
            : undefined;
        if (status === 404) return;
        throw e;
      }
    }, `delete-answer:${answerPostId}`);
  }

  /** After vote changes — refreshes counts from DB for question or answer post. */
  syncPostVoteCounts(postId: number): void {
    this.run(() => this.patchPostVotes(postId), `votes:${postId}`);
  }

  syncUserById(userId: number): void {
    this.run(() => this.upsertUser(userId), `user:${userId}`);
  }

  removeUserDocument(userId: number): void {
    this.run(async () => {
      if (!this.client) return;
      try {
        await this.client
          .collections(SEARCH_COLLECTION_USERS)
          .documents(String(userId))
          .delete();
      } catch (e: unknown) {
        const status =
          e && typeof e === 'object' && 'httpStatus' in e
            ? (e as { httpStatus?: number }).httpStatus
            : undefined;
        if (status === 404) return;
        throw e;
      }
    }, `delete-user:${userId}`);
  }

  syncTagById(tagId: number): void {
    this.run(() => this.upsertTag(tagId), `tag:${tagId}`);
  }

  syncTagsByIds(tagIds: number[]): void {
    const unique = Array.from(new Set(tagIds)).filter((id) => id > 0);
    if (unique.length === 0) return;
    this.run(async () => {
      for (const id of unique) {
        await this.upsertTag(id);
      }
    }, `tags:${unique.join(',')}`);
  }

  /** When a question title changes, patch embedded parent_title on all answers. */
  updateAnswersParentTitle(questionId: number, parentTitle: string): void {
    this.run(async () => {
      if (!this.client) return;
      const answers = await this.prisma.post.findMany({
        where: {
          parentQuestionId: questionId,
          type: PostType.ANSWER,
        },
        select: { id: true },
      });
      const title = parentTitle.trim() || 'Untitled question';
      for (const a of answers) {
        await this.client
          .collections(SEARCH_COLLECTION_ANSWERS)
          .documents(String(a.id))
          .update({ parent_title: title });
      }
    }, `answers-parent-title:${questionId}`);
  }

  private async upsertQuestion(postId: number): Promise<void> {
    if (!this.client) return;
    const post = await this.prisma.post.findFirst({
      where: { id: postId, type: PostType.QUESTION },
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
    if (!post) {
      await this.safeDeleteQuestionDoc(String(postId));
      return;
    }

    const doc = {
      id: String(post.id),
      title: post.title ?? '',
      body_mdx: post.bodyMdx,
      tag_display_names: post.questionTags.map((qt) => qt.tag.displayName),
      author_username: post.user.username,
      author_full_name: post.user.fullName ?? undefined,
      up_vote_count: post.upVoteCount,
      created_at: post.createdAt.getTime(),
      status: post.status,
    };

    await this.client
      .collections(SEARCH_COLLECTION_QUESTIONS)
      .documents()
      .upsert(doc);
  }

  private async upsertAnswer(answerPostId: number): Promise<void> {
    if (!this.client) return;
    const post = await this.prisma.post.findFirst({
      where: { id: answerPostId, type: PostType.ANSWER },
      select: {
        id: true,
        bodyMdx: true,
        parentQuestionId: true,
        upVoteCount: true,
        createdAt: true,
        status: true,
        user: { select: { username: true, fullName: true } },
        parentQuestion: { select: { id: true, title: true } },
      },
    });
    if (!post?.parentQuestionId || !post.parentQuestion) {
      await this.safeDeleteAnswerDoc(String(answerPostId));
      return;
    }

    const doc = {
      id: String(post.id),
      body_mdx: post.bodyMdx,
      parent_question_id: post.parentQuestionId,
      parent_title: post.parentQuestion.title ?? '',
      author_username: post.user.username,
      author_full_name: post.user.fullName ?? undefined,
      up_vote_count: post.upVoteCount,
      created_at: post.createdAt.getTime(),
      status: post.status,
    };

    await this.client
      .collections(SEARCH_COLLECTION_ANSWERS)
      .documents()
      .upsert(doc);
  }

  private async patchPostVotes(postId: number): Promise<void> {
    if (!this.client) return;
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { type: true, upVoteCount: true, status: true },
    });
    if (!post) return;

    const collection =
      post.type === PostType.QUESTION
        ? SEARCH_COLLECTION_QUESTIONS
        : SEARCH_COLLECTION_ANSWERS;

    if (post.status !== PostStatus.ACTIVE) {
      if (post.type === PostType.QUESTION) {
        await this.safeDeleteQuestionDoc(String(postId));
      } else {
        await this.safeDeleteAnswerDoc(String(postId));
      }
      return;
    }

    try {
      await this.client
        .collections(collection)
        .documents(String(postId))
        .update({ up_vote_count: post.upVoteCount });
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'httpStatus' in e
          ? (e as { httpStatus?: number }).httpStatus
          : undefined;
      if (status === 404) {
        if (post.type === PostType.QUESTION) {
          await this.upsertQuestion(postId);
        } else {
          await this.upsertAnswer(postId);
        }
        return;
      }
      throw e;
    }
  }

  private async upsertUser(userId: number): Promise<void> {
    if (!this.client) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        reputation: true,
        status: true,
      },
    });
    if (!user) {
      await this.safeDeleteUserDoc(String(userId));
      return;
    }
    if (user.status !== UserStatus.ACTIVE) {
      await this.safeDeleteUserDoc(String(userId));
      return;
    }

    await this.client.collections(SEARCH_COLLECTION_USERS).documents().upsert({
      id: String(user.id),
      username: user.username,
      full_name: user.fullName ?? undefined,
      reputation: user.reputation,
      status: user.status,
    });
  }

  private async upsertTag(tagId: number): Promise<void> {
    if (!this.client) return;
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: {
        id: true,
        slug: true,
        displayName: true,
        questionCount: true,
      },
    });
    if (!tag) {
      try {
        await this.client
          .collections(SEARCH_COLLECTION_TAGS)
          .documents(String(tagId))
          .delete();
      } catch (e: unknown) {
        const status =
          e && typeof e === 'object' && 'httpStatus' in e
            ? (e as { httpStatus?: number }).httpStatus
            : undefined;
        if (status !== 404) throw e;
      }
      return;
    }

    await this.client.collections(SEARCH_COLLECTION_TAGS).documents().upsert({
      id: String(tag.id),
      slug: tag.slug,
      display_name: tag.displayName,
      question_count: tag.questionCount,
    });
  }

  private async safeDeleteQuestionDoc(id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client
        .collections(SEARCH_COLLECTION_QUESTIONS)
        .documents(id)
        .delete();
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'httpStatus' in e
          ? (e as { httpStatus?: number }).httpStatus
          : undefined;
      if (status !== 404) throw e;
    }
  }

  private async safeDeleteAnswerDoc(id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client
        .collections(SEARCH_COLLECTION_ANSWERS)
        .documents(id)
        .delete();
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'httpStatus' in e
          ? (e as { httpStatus?: number }).httpStatus
          : undefined;
      if (status !== 404) throw e;
    }
  }

  private async safeDeleteUserDoc(id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.collections(SEARCH_COLLECTION_USERS).documents(id).delete();
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'httpStatus' in e
          ? (e as { httpStatus?: number }).httpStatus
          : undefined;
      if (status !== 404) throw e;
    }
  }
}

/** Used by CLI reindex script (non-DI). */
export function createTypesenseClientFromEnv(): Client | null {
  const opts = getTypesenseConfigurationOptions();
  if (!opts) return null;
  return new Typesense.Client(opts);
}
