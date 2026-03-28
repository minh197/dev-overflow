import { Injectable } from '@nestjs/common';
import { CommunityRole, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListUsersQueryDto,
  UserDirectorySort,
} from './dto/list-users-query.dto';

const DEFAULT_LIMIT = 500;

const userListSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  reputation: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(dto: ListUsersQueryDto) {
    const sort = dto.sort ?? UserDirectorySort.reputation;
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const q = dto.q?.trim();

    const baseWhere: Prisma.UserWhereInput = {
      status: UserStatus.ACTIVE,
      ...(q && q.length > 0
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (sort === UserDirectorySort.moderators) {
      const users = await this.prisma.user.findMany({
        where: {
          ...baseWhere,
          communityMembers: {
            some: {
              role: { in: [CommunityRole.MODERATOR, CommunityRole.ADMIN] },
            },
          },
        },
        orderBy: [{ reputation: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        select: userListSelect,
      });
      return { users };
    }

    if (sort === UserDirectorySort.popular) {
      const users = await this.prisma.user.findMany({
        where: baseWhere,
        orderBy: [{ posts: { _count: 'desc' } }, { reputation: 'desc' }],
        take: limit,
        select: userListSelect,
      });
      return { users };
    }

    const users = await this.prisma.user.findMany({
      where: baseWhere,
      orderBy: [{ reputation: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: userListSelect,
    });
    return { users };
  }
}
