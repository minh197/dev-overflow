import { AuthProvider, AuthTokenType } from '@prisma/client';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { ACCOUNT_LINK_TTL_MS } from '../auth.constants';
import {
  getAccessTokenSecret,
  getApiBaseUrl,
  getWebBaseUrl,
} from '../auth-env';
import { authUserSelect, normalizeNextPath } from '../auth.shared';
import type { OAuthStatePayload } from '../auth.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountLinkingService } from '../services/account-linking.service';
import { AuthOpaqueTokenService } from '../services/auth-opaque-token.service';
import { AuthSessionService } from '../services/auth-session.service';
import { UsernameReservationService } from '../services/username-reservation.service';
import { GitHubOAuthProvider } from './github-oauth.provider';
import { GoogleOAuthProvider } from './google-oauth.provider';
import type { OAuthProviderStrategy } from './oauth-provider.strategy';

@Injectable()
export class OAuthFlowService {
  private readonly strategies: Map<AuthProvider, OAuthProviderStrategy>;

  constructor(
    github: GitHubOAuthProvider,
    google: GoogleOAuthProvider,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionService,
    private readonly opaqueTokens: AuthOpaqueTokenService,
    private readonly accountLinking: AccountLinkingService,
    private readonly usernameReservation: UsernameReservationService,
  ) {
    this.strategies = new Map<AuthProvider, OAuthProviderStrategy>([
      [AuthProvider.GITHUB, github],
      [AuthProvider.GOOGLE, google],
    ]);
  }

  private strategyFor(provider: AuthProvider): OAuthProviderStrategy {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new UnauthorizedException('Unknown OAuth provider.');
    }
    return strategy;
  }

  private assertProviderIsConfigured(provider: AuthProvider) {
    const strategy = this.strategyFor(provider);
    if (!strategy.isConfigured()) {
      throw new ServiceUnavailableException(
        `${strategy.getSlug()} OAuth is not configured.`,
      );
    }
  }

  async buildProviderAuthorizationUrl(
    provider: AuthProvider,
    next: string | undefined,
    intent: 'sign-in' | 'link',
    userId?: number,
  ) {
    this.assertProviderIsConfigured(provider);
    const strategy = this.strategyFor(provider);

    const nextPath = normalizeNextPath(next);
    const state = await this.jwtService.signAsync<OAuthStatePayload>(
      {
        provider,
        intent,
        nextPath,
        userId,
        type: 'oauth-state',
      },
      {
        secret: getAccessTokenSecret(),
        expiresIn: '10m',
      },
    );

    const callbackUrl = `${getApiBaseUrl()}/auth/${strategy.getSlug()}/callback`;
    return strategy.buildAuthorizationUrl(state, callbackUrl);
  }

  async handleProviderCallback(
    provider: AuthProvider,
    code: string,
    state: string,
    request: Request,
    response: Response,
  ) {
    const payload = await this.jwtService.verifyAsync<OAuthStatePayload>(
      state,
      {
        secret: getAccessTokenSecret(),
      },
    );

    if (payload.type !== 'oauth-state' || payload.provider !== provider) {
      throw new UnauthorizedException('Invalid provider callback state.');
    }

    const strategy = this.strategyFor(provider);
    const profile = await strategy.exchangeCodeForProfile(
      code,
      getApiBaseUrl(),
    );

    if (payload.intent === 'link') {
      if (!payload.userId) {
        throw new UnauthorizedException(
          'Missing user context for account link.',
        );
      }

      const linkedUser = await this.accountLinking.linkProviderAccount(
        payload.userId,
        profile,
      );
      await this.sessions.createSessionForUser(linkedUser, request, response);
      response.redirect(
        `${getWebBaseUrl()}${normalizeNextPath(payload.nextPath)}?linked=${strategy.getSlug()}`,
      );
      return;
    }

    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: {
        user: {
          select: authUserSelect,
        },
      },
    });

    if (existingAccount?.user) {
      await this.sessions.createSessionForUser(
        existingAccount.user,
        request,
        response,
      );
      response.redirect(
        `${getWebBaseUrl()}${normalizeNextPath(payload.nextPath)}`,
      );
      return;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: {
        ...authUserSelect,
        passwordHash: true,
      },
    });

    if (existingUser) {
      const { rawToken } = await this.opaqueTokens.createStoredToken({
        userId: existingUser.id,
        type: AuthTokenType.ACCOUNT_LINK,
        ttlMs: ACCOUNT_LINK_TTL_MS,
        payload: {
          provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          nextPath: payload.nextPath,
        },
      });

      response.redirect(
        `${getWebBaseUrl()}/account-link-conflict?token=${encodeURIComponent(
          rawToken,
        )}&provider=${strategy.getSlug()}&email=${encodeURIComponent(
          profile.email,
        )}`,
      );
      return;
    }

    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        username: await this.usernameReservation.generateUniqueUsername(
          profile.email,
        ),
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        emailVerifiedAt: new Date(),
        accounts: {
          create: {
            provider,
            providerAccountId: profile.providerAccountId,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
          },
        },
      },
      select: authUserSelect,
    });

    await this.sessions.createSessionForUser(user, request, response);
    response.redirect(
      `${getWebBaseUrl()}${normalizeNextPath(payload.nextPath)}`,
    );
  }
}
