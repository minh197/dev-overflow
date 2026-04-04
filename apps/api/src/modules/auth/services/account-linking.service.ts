import { AuthProvider, UserStatus } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { authUserSelect } from '../auth.shared';
import type { ProviderProfile } from '../auth.types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AccountLinkingService {
  constructor(private readonly prisma: PrismaService) {}

  async linkProviderAccount(userId: number, profile: ProviderProfile) {
    const existingLinkedAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
    });

    if (existingLinkedAccount && existingLinkedAccount.userId !== userId) {
      throw new ConflictException('That social account is already linked.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...authUserSelect,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Unable to link provider for this user.');
    }

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      update: {
        userId,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
      create: {
        userId,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
    });

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: authUserSelect,
    });
  }

  async unlinkProvider(userId: number, provider: AuthProvider) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const account = user.accounts.find((item) => item.provider === provider);
    if (!account) {
      return { success: true };
    }

    const remainingMethods =
      (user.passwordHash ? 1 : 0) + (user.accounts.length - 1);

    if (remainingMethods === 0) {
      throw new BadRequestException(
        'You must keep at least one sign-in method on your account.',
      );
    }

    await this.prisma.account.delete({
      where: { id: account.id },
    });

    return { success: true };
  }
}
