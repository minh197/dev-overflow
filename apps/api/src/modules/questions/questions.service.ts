import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, PostType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';
import { GetHotQuestionsQueryDto } from './dto/get-hot-questions-query.dto';
import { QuestionsSort } from './dto/get-questions-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
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

type QuestionDetailRow = ListQuestionRow & {
  userId: number;
  bodyMdx: string;
  status: PostStatus;
};

type Actor = {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveActor(): Promise<Actor> {
    const actor =
      (await this.prisma.user.findFirst({
        where: { username: 'seed_alex' },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      })) ??
      (await this.prisma.user.findFirst({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      }));

    if (!actor) {
      throw new NotFoundException(
        'No dev user found. Run prisma seed to enable question mutations.',
      );
    }

    return actor;
  }

  private isAdmin(actor: Actor): boolean {
    const usernames = (process.env.QUESTION_ADMIN_USERNAMES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return usernames.includes(actor.username);
  }

  private toQuestionSummary(post: ListQuestionRow, actor: Actor) {
    const canManage = post.user.id === actor.id || this.isAdmin(actor);
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

  private async getQuestionByIdOrThrow(id: number): Promise<QuestionDetailRow> {
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
    })) as QuestionDetailRow | null;

    if (!post) {
      throw new NotFoundException('Question not found.');
    }
    return post;
  }

  private assertCanManage(actor: Actor, ownerUserId: number) {
    const canManage = ownerUserId === actor.id || this.isAdmin(actor);
    if (!canManage) {
      throw new ForbiddenException(
        'You do not have permission to modify this question.',
      );
    }
  }

  async listQuestions(query: GetQuestionsQueryDto) {
    const actor = await this.resolveActor();
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

  async getQuestion(id: number) {
    const actor = await this.resolveActor();
    const post = await this.getQuestionByIdOrThrow(id);

    return {
      ...this.toQuestionSummary(post, actor),
      bodyMdx: post.bodyMdx,
      status: post.status,
    };
  }

  async createQuestion(dto: CreateQuestionDto) {
    const actor = await this.resolveActor();
    const tagIds = await this.assertTagIdsExist(dto.tagIds);

    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          uuid: randomUUID(),
          userId: actor.id,
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

    return this.getQuestion(created);
  }

  async updateQuestion(id: number, dto: UpdateQuestionDto) {
    const actor = await this.resolveActor();
    const existing = await this.getQuestionByIdOrThrow(id);
    this.assertCanManage(actor, existing.userId);

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

    return this.getQuestion(id);
  }

  async deleteQuestion(id: number) {
    const actor = await this.resolveActor();
    const existing = await this.getQuestionByIdOrThrow(id);
    this.assertCanManage(actor, existing.userId);

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

    return { id, deleted: true };
  }
}
