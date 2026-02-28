import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe() {
    const user =
      (await this.prisma.user.findFirst({
        where: {
          username: 'seed_alex',
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      })) ??
      (await this.prisma.user.findFirst({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      }));

    if (!user) {
      throw new NotFoundException(
        'No dev user found. Run prisma seed to enable /auth/me.',
      );
    }

    return user;
  }
}
