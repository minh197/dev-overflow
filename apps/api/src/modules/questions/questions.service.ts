import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostStatus, PostType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchIndexService } from '../search/search-index.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';
import { GetHotQuestionsQueryDto } from './dto/get-hot-questions-query.dto';
import { QuestionsSort } from './dto/get-questions-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { AnswerSort, GetQuestionQueryDto } from './dto/get-question-query.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

type QuestionTagRow = {
  tag: {
    id: number;
    displayName: string;
  };
};

type ListQuestionRow = {
  id: number;
  title: string | null;
  createdAt: Date;
  upVoteCount: number;
  answerCount: number;
  viewCount: number;
  user: {
    id: number;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
  questionTags: QuestionTagRow[];
};

type QuestionAnswerRow = {
  id: number;
  bodyMdx: string;
  createdAt: Date;
  upVoteCount: number;
  downVoteCount: number;
  user: {
    id: number;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
  votes?: { value: number }[];
};

type QuestionDetailRow = ListQuestionRow & {
  userId: number;
  bodyMdx: string;
  status: PostStatus;
  downVoteCount: number;
  answers: QuestionAnswerRow[];
  votes?: { value: number }[];
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  private isAdmin(actor: AuthUser | null): boolean {
    if (!actor) return false;
    const usernames = (process.env.QUESTION_ADMIN_USERNAMES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return usernames.includes(actor.username);
  }

  private toQuestionSummary(post: ListQuestionRow, actor: AuthUser | null) {
    const canManage = actor
      ? post.user.id === actor.id || this.isAdmin(actor)
      : false;
    return {
      id: post.id,
      userId: post.user.id,
      title: post.title,
      createdAt: post.createdAt,
      upVoteCount: post.upVoteCount,
      answerCount: post.answerCount,
      viewCount: post.viewCount,
      user: post.user,
      canEdit: canManage,
      canDelete: canManage,
      question: {
        id: post.id,
        questionTags: post.questionTags,
      },
    };
  }

  private async assertTagIdsExist(tagIds: number[]) {
    const uniqueTagIds = Array.from(new Set(tagIds));
    const existing = await this.prisma.tag.findMany({
      where: { id: { in: uniqueTagIds } },
      select: { id: true },
    });
    if (existing.length !== uniqueTagIds.length) {
      throw new NotFoundException('One or more tags do not exist.');
    }
    return uniqueTagIds;
  }

  private async syncTagCountsForIds(
    tx: Prisma.TransactionClient,
    tagIds: number[],
  ) {
    const uniqueTagIds = Array.from(new Set(tagIds));
    if (uniqueTagIds.length === 0) return;

    const usage = await tx.questionTag.groupBy({
      by: ['tagId'],
      where: { tagId: { in: uniqueTagIds } },
      _count: { tagId: true },
    });
    const countByTagId = new Map(
      usage.map((row) => [row.tagId, row._count.tagId]),
    );

    await Promise.all(
      uniqueTagIds.map((tagId) =>
        tx.tag.update({
          where: { id: tagId },
          data: { questionCount: countByTagId.get(tagId) ?? 0 },
        }),
      ),
    );
  }

  private async getQuestionByIdOrThrow(
    id: number,
    actor: AuthUser | null,
    options?: { answerSort?: AnswerSort },
  ): Promise<QuestionDetailRow> {
    const answerSort = options?.answerSort ?? AnswerSort.UPVOTES;
    const answerOrderBy =
      answerSort === AnswerSort.NEWEST
        ? ([{ createdAt: 'desc' as const }, { id: 'desc' as const }] as const)
        : ([
            { upVoteCount: 'desc' as const },
            { createdAt: 'asc' as const },
          ] as const);

    const answerSelect = {
      id: true,
      bodyMdx: true,
      createdAt: true,
      upVoteCount: true,
      downVoteCount: true,
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          avatarUrl: true,
        },
      },
      ...(actor
        ? {
            votes: {
              where: { userId: actor.id },
              take: 1,
              select: { value: true },
            },
          }
        : {}),
    };

    const post = (await this.prisma.post.findFirst({
      where: {
        id,
        type: PostType.QUESTION,
        status: PostStatus.ACTIVE,
      },
      select: {
        id: true,
        userId: true,
        title: true,
        bodyMdx: true,
        status: true,
        createdAt: true,
        upVoteCount: true,
        downVoteCount: true,
        answerCount: true,
        viewCount: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        ...(actor
          ? {
              votes: {
                where: { userId: actor.id },
                take: 1,
                select: { value: true },
              },
            }
          : {}),
        questionTags: {
          select: {
            tag: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
        answers: {
          where: {
            type: PostType.ANSWER,
            status: PostStatus.ACTIVE,
          },
          orderBy: [...answerOrderBy],
          select: answerSelect,
        },
      },
    })) as QuestionDetailRow | null;

    if (!post) {
      throw new NotFoundException('Question not found.');
    }
    return post;
  }

  private assertCanManage(actor: AuthUser, ownerUserId: number) {
    const canManage = ownerUserId === actor.id || this.isAdmin(actor);
    if (!canManage) {
      throw new ForbiddenException(
        'You do not have permission to modify this question.',
      );
    }
  }

  private assertAuthenticated(actor: AuthUser | null): AuthUser {
    if (!actor) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return actor;
  }

  async listQuestions(query: GetQuestionsQueryDto, actor: AuthUser | null) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const sort = query.sort ?? QuestionsSort.NEWEST;

    const where = {
      type: PostType.QUESTION,
      status: PostStatus.ACTIVE,
      ...(sort === QuestionsSort.UNANSWERED ? { answerCount: 0 } : {}),
      ...(query.q
        ? { title: { contains: query.q, mode: 'insensitive' as const } }
        : {}),
    };

    const orderByMap = {
      [QuestionsSort.NEWEST]: [
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ],
      [QuestionsSort.RECOMMENDED]: [
        { upVoteCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ],
      [QuestionsSort.FREQUENT]: [
        { viewCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ],
      [QuestionsSort.UNANSWERED]: [
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ],
    };

    const posts = (await this.prisma.post.findMany({
      where: {
        ...where,
      },
      orderBy: orderByMap[sort],
      skip: offset,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        upVoteCount: true,
        answerCount: true,
        viewCount: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        questionTags: {
          select: {
            tag: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    })) as ListQuestionRow[];

    return posts.map((post) => this.toQuestionSummary(post, actor));
  }

  async listHotQuestions(query: GetHotQuestionsQueryDto) {
    const limit = query.limit ?? 5;
    const windowDays = query.windowDays ?? 7;
    const now = new Date();
    const sinceDate = new Date(
      now.getTime() - windowDays * 24 * 60 * 60 * 1000,
    );

    const posts = await this.prisma.post.findMany({
      where: {
        type: PostType.QUESTION,
        status: PostStatus.ACTIVE,
        createdAt: { gte: sinceDate },
      },
      orderBy: [
        { upVoteCount: 'desc' },
        { answerCount: 'desc' },
        { viewCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
      },
    });

    return posts.map((post) => ({
      ...post,
      question: {
        id: post.id,
      },
    }));
  }

  async getQuestion(
    id: number,
    actor: AuthUser | null,
    query?: GetQuestionQueryDto,
  ) {
    const post = await this.getQuestionByIdOrThrow(id, actor, {
      answerSort: query?.answerSort,
    });

    const questionUserVote = post.votes?.[0]?.value;
    const normalizedQuestionVote =
      questionUserVote === 1 || questionUserVote === -1
        ? questionUserVote
        : null;

    return {
      ...this.toQuestionSummary(post, actor),
      bodyMdx: post.bodyMdx,
      status: post.status,
      downVoteCount: post.downVoteCount,
      currentUserVote: normalizedQuestionVote,
      answers: post.answers.map((answer) => {
        const v = answer.votes?.[0]?.value;
        return {
          id: answer.id,
          bodyMdx: answer.bodyMdx,
          createdAt: answer.createdAt,
          upVoteCount: answer.upVoteCount,
          downVoteCount: answer.downVoteCount,
          currentUserVote: v === 1 || v === -1 ? v : null,
          user: answer.user,
        };
      }),
    };
  }

  async createAnswer(
    questionId: number,
    actor: AuthUser | null,
    dto: CreateAnswerDto,
  ) {
    const currentUser = this.assertAuthenticated(actor);

    const newAnswerId = await this.prisma.$transaction(async (tx) => {
      const parent = await tx.post.findFirst({
        where: {
          id: questionId,
          type: PostType.QUESTION,
          status: PostStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!parent) {
        throw new NotFoundException('Question not found.');
      }

      const created = await tx.post.create({
        data: {
          uuid: randomUUID(),
          userId: currentUser.id,
          parentQuestionId: questionId,
          title: null,
          bodyMdx: dto.bodyMdx.trim(),
          type: PostType.ANSWER,
          status: PostStatus.ACTIVE,
        },
        select: { id: true },
      });

      await tx.post.update({
        where: { id: questionId },
        data: { answerCount: { increment: 1 } },
      });

      return created.id;
    });

    this.searchIndex.syncAnswerById(newAnswerId);

    return this.getQuestion(questionId, currentUser);
  }

  async createQuestion(actor: AuthUser | null, dto: CreateQuestionDto) {
    const currentUser = this.assertAuthenticated(actor);
    const tagIds = await this.assertTagIdsExist(dto.tagIds);

    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          uuid: randomUUID(),
          userId: currentUser.id,
          title: dto.title.trim(),
          bodyMdx: dto.bodyMdx.trim(),
          type: PostType.QUESTION,
          status: PostStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      await tx.questionTag.createMany({
        data: tagIds.map((tagId) => ({
          postId: post.id,
          tagId,
        })),
        skipDuplicates: true,
      });

      await this.syncTagCountsForIds(tx, tagIds);
      return post.id;
    });

    this.searchIndex.syncQuestionById(created);
    this.searchIndex.syncTagsByIds(tagIds);

    return this.getQuestion(created, currentUser);
  }

  async updateQuestion(
    id: number,
    actor: AuthUser | null,
    dto: UpdateQuestionDto,
  ) {
    const currentUser = this.assertAuthenticated(actor);
    const existing = await this.getQuestionByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, existing.userId);

    const nextTagIds = dto.tagIds
      ? await this.assertTagIdsExist(dto.tagIds)
      : null;
    const existingTagIds = existing.questionTags.map((row) => row.tag.id);

    await this.prisma.$transaction(async (tx) => {
      if (dto.title !== undefined || dto.bodyMdx !== undefined) {
        await tx.post.update({
          where: { id },
          data: {
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.bodyMdx !== undefined
              ? { bodyMdx: dto.bodyMdx.trim() }
              : {}),
          },
        });
      }

      if (nextTagIds) {
        await tx.questionTag.deleteMany({ where: { postId: id } });
        await tx.questionTag.createMany({
          data: nextTagIds.map((tagId) => ({ postId: id, tagId })),
          skipDuplicates: true,
        });
        await this.syncTagCountsForIds(tx, [...existingTagIds, ...nextTagIds]);
      }
    });

    this.searchIndex.syncQuestionById(id);
    if (nextTagIds) {
      this.searchIndex.syncTagsByIds([...existingTagIds, ...nextTagIds]);
    }
    if (dto.title !== undefined) {
      this.searchIndex.updateAnswersParentTitle(id, dto.title.trim());
    }

    return this.getQuestion(id, currentUser);
  }

  async deleteQuestion(id: number, actor: AuthUser | null) {
    const currentUser = this.assertAuthenticated(actor);
    const existing = await this.getQuestionByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, existing.userId);

    const tagIds = existing.questionTags.map((row) => row.tag.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.questionTag.deleteMany({ where: { postId: id } });
      await tx.vote.deleteMany({ where: { postId: id } });
      await tx.bookmark.deleteMany({ where: { postId: id } });
      await tx.comment.deleteMany({ where: { postId: id } });
      await tx.postView.deleteMany({ where: { postId: id } });
      await tx.aiAnswer.deleteMany({ where: { postId: id } });
      await tx.post.delete({ where: { id } });
      await this.syncTagCountsForIds(tx, tagIds);
    });

    this.searchIndex.removeQuestionDocument(id);
    this.searchIndex.deleteAnswersForQuestion(id);
    this.searchIndex.syncTagsByIds(tagIds);

    return { id, deleted: true };
  }
}
