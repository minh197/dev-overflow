import { Injectable } from '@nestjs/common';
import { PostStatus, PostType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';
import { GetHotQuestionsQueryDto } from './dto/get-hot-questions-query.dto';
import { QuestionsSort } from './dto/get-questions-query.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listQuestions(query: GetQuestionsQueryDto) {
    const limit = query.limit ?? 20;
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

    return this.prisma.post.findMany({
      where: {
        ...where,
      },
      orderBy: orderByMap[sort],
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
        question: {
          select: {
            id: true,
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
        },
      },
    });
  }

  async listHotQuestions(query: GetHotQuestionsQueryDto) {
    const limit = query.limit ?? 5;
    const windowDays = query.windowDays ?? 7;
    const now = new Date();
    const sinceDate = new Date(
      now.getTime() - windowDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.post.findMany({
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
        question: {
          select: {
            id: true,
          },
        },
      },
    });
  }
}
