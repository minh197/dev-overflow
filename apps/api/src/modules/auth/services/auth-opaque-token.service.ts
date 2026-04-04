import { AuthTokenType, Prisma } from '@prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRawToken, hashToken } from '../auth-crypto.util';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthOpaqueTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async createStoredToken(args: {
    userId?: number;
    type: AuthTokenType;
    ttlMs: number;
    payload?: Prisma.InputJsonValue;
  }) {
    const rawToken = createRawToken();
    await this.prisma.authToken.create({
      data: {
        userId: args.userId,
        type: args.type,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + args.ttlMs),
        payload: args.payload,
      },
    });
    return { rawToken };
  }

  async consumeStoredToken(rawToken: string, type: AuthTokenType) {
    const token = await this.prisma.authToken.findFirst({
      where: {
        tokenHash: hashToken(rawToken),
        type,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      throw new UnauthorizedException('Token is invalid or has expired.');
    }

    return this.prisma.authToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
  }
}
