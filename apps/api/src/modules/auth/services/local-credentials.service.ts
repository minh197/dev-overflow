import { AuthTokenType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PASSWORD_RESET_TTL_MS } from '../auth.constants';
import { getWebBaseUrl } from '../auth-env';
import { authUserSelect, normalizeEmail, toAuthUser } from '../auth.shared';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SignInDto } from '../dto/sign-in.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthOpaqueTokenService } from './auth-opaque-token.service';
import { AuthSessionService } from './auth-session.service';

@Injectable()
export class LocalCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opaqueTokens: AuthOpaqueTokenService,
    private readonly sessions: AuthSessionService,
  ) {}

  async signUp(dto: SignUpDto) {
    const email = normalizeEmail(dto.email);
    const username = dto.username.trim();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (existing?.email === email) {
      throw new ConflictException('An account already exists for that email.');
    }

    if (existing?.username === username) {
      throw new ConflictException('That username is already taken.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: authUserSelect,
    });

    return { user };
  }

  async signIn(dto: SignInDto, request: Request, response: Response) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...authUserSelect,
        passwordHash: true,
        status: true,
      },
    });

    if (!user || !user.passwordHash || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.sessions.createSessionForUser(user, request, response);
    return { user: toAuthUser(user) };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      await this.prisma.authToken.updateMany({
        where: {
          userId: user.id,
          type: AuthTokenType.PASSWORD_RESET,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      const { rawToken } = await this.opaqueTokens.createStoredToken({
        userId: user.id,
        type: AuthTokenType.PASSWORD_RESET,
        ttlMs: PASSWORD_RESET_TTL_MS,
      });

      const resetUrl = `${getWebBaseUrl()}/reset-password/${encodeURIComponent(
        rawToken,
      )}`;

      return {
        success: true,
        email,
        ...(process.env.NODE_ENV !== 'production' ? { resetUrl } : {}),
      };
    }

    return { success: true, email };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    request: Request,
    response: Response,
  ) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const tokenRecord = await this.opaqueTokens.consumeStoredToken(
      dto.token,
      AuthTokenType.PASSWORD_RESET,
    );

    if (!tokenRecord.userId) {
      throw new UnauthorizedException('Reset token is invalid.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: tokenRecord.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: tokenRecord.userId },
      select: authUserSelect,
    });

    await this.sessions.createSessionForUser(user, request, response);
    return { user };
  }
}
