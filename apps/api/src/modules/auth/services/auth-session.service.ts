import { UserStatus } from '@prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from '../auth.constants';
import { getAccessTokenSecret } from '../auth-env';
import { authUserSelect } from '../auth.shared';
import { createRawToken, hashToken } from '../auth-crypto.util';
import type {
  AccessTokenPayload,
  AuthUser,
  AuthenticatedRequest,
} from '../auth.types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createSessionForUser(
    user: AuthUser,
    request: Request,
    response: Response,
  ) {
    const refreshToken = createRawToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: request.headers['user-agent']?.slice(0, 512),
        ipAddress: request.ip ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    await this.writeAuthCookies(response, {
      userId: user.id,
      sessionId: session.id,
      refreshToken,
    });
  }

  async signOut(request: Request, response: Response) {
    const refreshToken = this.readCookie(request, REFRESH_TOKEN_COOKIE);

    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: {
          refreshTokenHash: hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    this.clearAuthCookies(response);
    return { success: true };
  }

  async rotateSessionFromRefreshToken(
    request: Request,
    response: Response,
    options: { required?: boolean } = {},
  ) {
    const refreshToken = this.readCookie(request, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      if (options.required) {
        throw new UnauthorizedException('Authentication is required.');
      }
      return null;
    }

    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            ...authUserSelect,
            passwordHash: true,
            status: true,
          },
        },
      },
    });

    if (!session || session.user.status !== UserStatus.ACTIVE) {
      this.clearAuthCookies(response);
      if (options.required) {
        throw new UnauthorizedException('Session is no longer valid.');
      }
      return null;
    }

    const nextRefreshToken = createRawToken();
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(nextRefreshToken),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent: request.headers['user-agent']?.slice(0, 512),
        ipAddress: request.ip ?? null,
      },
      include: {
        user: {
          select: {
            ...authUserSelect,
            passwordHash: true,
            status: true,
          },
        },
      },
    });

    await this.writeAuthCookies(response, {
      userId: updatedSession.user.id,
      sessionId: updatedSession.id,
      refreshToken: nextRefreshToken,
    });

    return updatedSession;
  }

  async getAuthenticatedUserFromRequest(
    request: Request,
    options: { required?: boolean } = {},
  ): Promise<AuthUser | null> {
    const token = this.getAccessTokenFromRequest(request);
    if (!token) {
      if (options.required) {
        throw new UnauthorizedException('Authentication is required.');
      }
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: getAccessTokenSecret(),
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token.');
      }

      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: authUserSelect,
          },
        },
      });

      if (!session || session.user === null) {
        throw new UnauthorizedException('Session is no longer valid.');
      }

      const typedRequest = request as AuthenticatedRequest;
      const sessionId = session.id;
      const user = session.user as AuthUser;
      typedRequest.authSessionId = sessionId;
      typedRequest.user = user;

      return user;
    } catch (error) {
      if (options.required) {
        throw error instanceof UnauthorizedException
          ? error
          : new UnauthorizedException('Authentication is required.');
      }
      return null;
    }
  }

  private async writeAuthCookies(
    response: Response,
    args: {
      userId: number;
      sessionId: number;
      refreshToken: string;
    },
  ) {
    const accessToken = await this.jwtService.signAsync<AccessTokenPayload>(
      {
        sub: args.userId,
        sessionId: args.sessionId,
        type: 'access',
      },
      {
        secret: getAccessTokenSecret(),
        expiresIn: `${Math.floor(ACCESS_TOKEN_TTL_MS / 1000)}s`,
      },
    );

    const secure = process.env.NODE_ENV === 'production';

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_MS,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, args.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  private getAccessTokenFromRequest(request: Request) {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length);
    }
    return this.readCookie(request, ACCESS_TOKEN_COOKIE);
  }

  private readCookie(request: Request, name: string) {
    const header = request.headers.cookie;
    if (!header) return null;

    const entries = header.split(';').map((chunk) => chunk.trim());
    for (const entry of entries) {
      const [key, ...valueParts] = entry.split('=');
      if (key === name) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return null;
  }
}
