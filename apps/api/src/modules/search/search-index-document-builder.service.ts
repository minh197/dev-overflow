import { Injectable } from '@nestjs/common';
import { PostType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchIndexDocumentBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildQuestionDocs(ids: number[]): Promise<{
    docs: Record<string, unknown>[];
    missingIds: number[];
  }> {
    const unique = [...new Set(ids)].filter((x) => x > 0);
    if (unique.length === 0) return { docs: [], missingIds: [] };

    const posts = await this.prisma.post.findMany({
      where: { id: { in: unique }, type: PostType.QUESTION },
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

    const found = new Set(posts.map((p) => p.id));
    const missingIds = unique.filter((id) => !found.has(id));

    const docs = posts.map((post) => ({
      id: String(post.id),
      title: post.title ?? '',
      body_mdx: post.bodyMdx,
      tag_display_names: post.questionTags.map((qt) => qt.tag.displayName),
      author_username: post.user.username,
      author_full_name: post.user.fullName ?? undefined,
      up_vote_count: post.upVoteCount,
      created_at: post.createdAt.getTime(),
      status: post.status,
    }));

    return { docs, missingIds };
  }

  async buildAnswerDocs(ids: number[]): Promise<{
    docs: Record<string, unknown>[];
    missingIds: number[];
  }> {
    const unique = [...new Set(ids)].filter((x) => x > 0);
    if (unique.length === 0) return { docs: [], missingIds: [] };

    const posts = await this.prisma.post.findMany({
      where: { id: { in: unique }, type: PostType.ANSWER },
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

    const found = new Set(posts.map((p) => p.id));
    const missingIds = unique.filter((id) => !found.has(id));

    const docs: Record<string, unknown>[] = [];
    for (const post of posts) {
      if (!post.parentQuestionId || !post.parentQuestion) {
        missingIds.push(post.id);
        continue;
      }
      docs.push({
        id: String(post.id),
        body_mdx: post.bodyMdx,
        parent_question_id: post.parentQuestionId,
        parent_title: post.parentQuestion.title ?? '',
        author_username: post.user.username,
        author_full_name: post.user.fullName ?? undefined,
        up_vote_count: post.upVoteCount,
        created_at: post.createdAt.getTime(),
        status: post.status,
      });
    }

    return { docs, missingIds };
  }

  async buildUserDocs(ids: number[]): Promise<{
    docs: Record<string, unknown>[];
    missingIds: number[];
  }> {
    const unique = [...new Set(ids)].filter((x) => x > 0);
    if (unique.length === 0) return { docs: [], missingIds: [] };

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        username: true,
        fullName: true,
        reputation: true,
        status: true,
      },
    });

    const found = new Set(users.map((u) => u.id));
    const missingIds = unique.filter((id) => !found.has(id));

    const docs: Record<string, unknown>[] = [];
    for (const user of users) {
      if (user.status !== UserStatus.ACTIVE) {
        missingIds.push(user.id);
        continue;
      }
      docs.push({
        id: String(user.id),
        username: user.username,
        full_name: user.fullName ?? undefined,
        reputation: user.reputation,
        status: user.status,
      });
    }

    return { docs, missingIds };
  }

  async buildTagDocs(ids: number[]): Promise<{
    docs: Record<string, unknown>[];
    missingIds: number[];
  }> {
    const unique = [...new Set(ids)].filter((x) => x > 0);
    if (unique.length === 0) return { docs: [], missingIds: [] };

    const tags = await this.prisma.tag.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        slug: true,
        displayName: true,
        questionCount: true,
      },
    });

    const found = new Set(tags.map((t) => t.id));
    const missingIds = unique.filter((id) => !found.has(id));

    const docs = tags.map((tag) => ({
      id: String(tag.id),
      slug: tag.slug,
      display_name: tag.displayName,
      question_count: tag.questionCount,
    }));

    return { docs, missingIds };
  }

  async answerPostIdsForQuestion(questionId: number): Promise<number[]> {
    const rows = await this.prisma.post.findMany({
      where: { parentQuestionId: questionId, type: PostType.ANSWER },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
