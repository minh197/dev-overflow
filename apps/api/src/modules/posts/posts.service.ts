import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, PostType, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchIndexService } from '../search/search-index.service';
import type { CastVoteDto } from './dto/cast-vote.dto';

export type CastVoteResult = {
  postId: number;
  upVoteCount: number;
  downVoteCount: number;
  userVote: 1 | -1 | null;
};

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  async castVote(
    postId: number,
    actor: AuthUser,
    dto: CastVoteDto,
  ): Promise<CastVoteResult> {
    const value = dto.value;

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`,
      );

      const post = await tx.post.findFirst({
        where: {
          id: postId,
          status: PostStatus.ACTIVE,
          type: { in: [PostType.QUESTION, PostType.ANSWER] },
        },
        select: { id: true, userId: true },
      });

      if (!post) {
        throw new NotFoundException('Post not found.');
      }

      if (post.userId === actor.id) {
        throw new ForbiddenException('You cannot vote on your own post.');
      }

      const existing = await tx.vote.findUnique({
        where: {
          userId_postId: { userId: actor.id, postId },
        },
      });

      const prev = existing?.value ?? 0;
      if (prev === value) {
        return;
      }

      let deltaUp = 0;
      let deltaDown = 0;
      if (prev === 1) deltaUp -= 1;
      if (prev === -1) deltaDown -= 1;
      if (value === 1) deltaUp += 1;
      if (value === -1) deltaDown += 1;

      if (value === 0) {
        if (existing) {
          await tx.vote.delete({
            where: { userId_postId: { userId: actor.id, postId } },
          });
        }
      } else {
        await tx.vote.upsert({
          where: { userId_postId: { userId: actor.id, postId } },
          create: { userId: actor.id, postId, value },
          update: { value },
        });
      }

      if (deltaUp !== 0 || deltaDown !== 0) {
        await tx.post.update({
          where: { id: postId },
          data: {
            upVoteCount: { increment: deltaUp },
            downVoteCount: { increment: deltaDown },
          },
        });
      }
    });

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { upVoteCount: true, downVoteCount: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const voteRow = await this.prisma.vote.findUnique({
      where: { userId_postId: { userId: actor.id, postId } },
      select: { value: true },
    });

    const userVote: CastVoteResult['userVote'] =
      voteRow?.value === 1 || voteRow?.value === -1 ? voteRow.value : null;

    const result: CastVoteResult = {
      postId,
      upVoteCount: post.upVoteCount,
      downVoteCount: post.downVoteCount,
      userVote,
    };

    this.searchIndex.syncPostVoteCounts(postId);

    return result;
  }
}
