import { Injectable } from '@nestjs/common';
import { PostStatus, PostType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetGlobalSearchQueryDto } from './dto/get-global-search-query.dto';

type SearchQuestionRow = {
  id: number;
  title: string | null;
  createdAt: Date;
  user: {
    username: string;
    fullName: string | null;
  };
  questionTags: Array<{
    tag: {
      displayName: string;
    };
  }>;
};

type SearchAnswerRow = {
  id: number;
  bodyMdx: string;
  createdAt: Date;
  user: {
    username: string;
    fullName: string | null;
  };
  parentQuestion: {
    id: number;
    title: string | null;
  } | null;
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

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (normalized.length <= maxLength) {
      return normalized;
    }

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

  async searchGlobal(query: GetGlobalSearchQueryDto) {
    const normalizedQuery = query.q.trim();
    const limitPerType = query.limitPerType ?? 5;

    const [questions, answers, users, tags] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          type: PostType.QUESTION,
          status: PostStatus.ACTIVE,
          OR: [
            { title: { contains: normalizedQuery, mode: 'insensitive' } },
            { bodyMdx: { contains: normalizedQuery, mode: 'insensitive' } },
            {
              questionTags: {
                some: {
                  tag: {
                    OR: [
                      {
                        displayName: {
                          contains: normalizedQuery,
                          mode: 'insensitive',
                        },
                      },
                      {
                        slug: {
                          contains: normalizedQuery,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
        orderBy: [{ upVoteCount: 'desc' }, { answerCount: 'desc' }, { createdAt: 'desc' }],
        take: limitPerType,
        select: {
          id: true,
          title: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              fullName: true,
            },
          },
          questionTags: {
            select: {
              tag: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      }) as Promise<SearchQuestionRow[]>,
      this.prisma.post.findMany({
        where: {
          type: PostType.ANSWER,
          status: PostStatus.ACTIVE,
          parentQuestionId: { not: null },
          OR: [
            { bodyMdx: { contains: normalizedQuery, mode: 'insensitive' } },
            {
              parentQuestion: {
                is: {
                  title: { contains: normalizedQuery, mode: 'insensitive' },
                },
              },
            },
          ],
        },
        orderBy: [{ upVoteCount: 'desc' }, { createdAt: 'desc' }],
        take: limitPerType,
        select: {
          id: true,
          bodyMdx: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              fullName: true,
            },
          },
          parentQuestion: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }) as Promise<SearchAnswerRow[]>,
      this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          OR: [
            { username: { contains: normalizedQuery, mode: 'insensitive' } },
            { fullName: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ reputation: 'desc' }, { createdAt: 'desc' }],
        take: limitPerType,
        select: {
          id: true,
          username: true,
          fullName: true,
          reputation: true,
        },
      }) as Promise<SearchUserRow[]>,
      this.prisma.tag.findMany({
        where: {
          OR: [
            { displayName: { contains: normalizedQuery, mode: 'insensitive' } },
            { slug: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ questionCount: 'desc' }, { displayName: 'asc' }],
        take: limitPerType,
        select: {
          id: true,
          slug: true,
          displayName: true,
          questionCount: true,
        },
      }) as Promise<SearchTagRow[]>,
    ]);

    return {
      query: normalizedQuery,
      questions: questions.map((item) => ({
        id: String(item.id),
        title: item.title ?? 'Untitled question',
        href: `/questions/${item.id}`,
        authorName: item.user.fullName ?? item.user.username,
        createdAtLabel: this.toRelativeLabel(item.createdAt),
        tags: item.questionTags.map((tagRow) => tagRow.tag.displayName),
      })),
      answers: answers
        .filter((item) => item.parentQuestion)
        .map((item) => ({
          id: String(item.id),
          excerpt: this.snippet(item.bodyMdx, normalizedQuery),
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
