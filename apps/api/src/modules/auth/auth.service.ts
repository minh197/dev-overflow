import {
  AuthProvider,
  AuthTokenType,
  Prisma,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  ACCOUNT_LINK_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import type {
  AuthUser,
  AuthenticatedRequest,
  PendingAccountLinkPayload,
  ProviderProfile,
} from './auth.types';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { PrismaService } from '../../prisma/prisma.service';

type AccessTokenPayload = {
  sub: number;
  sessionId: number;
  type: 'access';
};

type OAuthStatePayload = {
  provider: AuthProvider;
  intent: 'sign-in' | 'link';
  nextPath: string;
  userId?: number;
  type: 'oauth-state';
};

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    const email = this.normalizeEmail(dto.email);
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
    const email = this.normalizeEmail(dto.email);
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

    await this.createSessionForUser(user, request, response);
    return { user: this.toAuthUser(user) };
  }

  async signOut(request: Request, response: Response) {
    const refreshToken = this.readCookie(request, REFRESH_TOKEN_COOKIE);

    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: {
          refreshTokenHash: this.hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    this.clearAuthCookies(response);
    return { success: true };
  }

  async refresh(request: Request, response: Response) {
    const session = await this.rotateSessionFromRefreshToken(
      request,
      response,
      {
        required: true,
      },
    );
    if (!session) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return { user: this.toAuthUser(session.user) };
  }

  async getMe(request: Request, response: Response) {
    const user = await this.getAuthenticatedUserFromRequest(request, {
      required: false,
    });

    if (user) {
      return user;
    }

    const session = await this.rotateSessionFromRefreshToken(
      request,
      response,
      {
        required: false,
      },
    );

    if (!session) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return this.toAuthUser(session.user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
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

      const { rawToken } = await this.createStoredToken({
        userId: user.id,
        type: AuthTokenType.PASSWORD_RESET,
        ttlMs: PASSWORD_RESET_TTL_MS,
      });

      const resetUrl = `${this.getWebBaseUrl()}/reset-password/${encodeURIComponent(
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

    const tokenRecord = await this.consumeStoredToken(
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

    await this.createSessionForUser(user, request, response);
    return { user };
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
          secret: this.getAccessTokenSecret(),
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

  async buildProviderAuthorizationUrl(
    provider: AuthProvider,
    next: string | undefined,
    intent: 'sign-in' | 'link',
    userId?: number,
  ) {
    this.assertProviderIsConfigured(provider);

    const nextPath = this.normalizeNextPath(next);
    const state = await this.jwtService.signAsync<OAuthStatePayload>(
      {
        provider,
        intent,
        nextPath,
        userId,
        type: 'oauth-state',
      },
      {
        secret: this.getAccessTokenSecret(),
        expiresIn: '10m',
      },
    );

    const callbackUrl = `${this.getApiBaseUrl()}/auth/${this.getProviderSlug(
      provider,
    )}/callback`;

    const params = new URLSearchParams();
    params.set('client_id', this.getProviderClientId(provider));
    params.set('redirect_uri', callbackUrl);
    params.set('state', state);

    if (provider === AuthProvider.GITHUB) {
      params.set('scope', 'read:user user:email');
      return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    params.set('response_type', 'code');
    params.set('scope', 'openid email profile');
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
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
        secret: this.getAccessTokenSecret(),
      },
    );

    if (payload.type !== 'oauth-state' || payload.provider !== provider) {
      throw new UnauthorizedException('Invalid provider callback state.');
    }

    const profile = await this.fetchProviderProfile(provider, code);

    if (payload.intent === 'link') {
      if (!payload.userId) {
        throw new UnauthorizedException(
          'Missing user context for account link.',
        );
      }

      const linkedUser = await this.linkProviderAccount(
        payload.userId,
        profile,
      );
      await this.createSessionForUser(linkedUser, request, response);
      response.redirect(
        `${this.getWebBaseUrl()}${this.normalizeNextPath(payload.nextPath)}?linked=${this.getProviderSlug(provider)}`,
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
      await this.createSessionForUser(existingAccount.user, request, response);
      response.redirect(
        `${this.getWebBaseUrl()}${this.normalizeNextPath(payload.nextPath)}`,
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
      const { rawToken } = await this.createStoredToken({
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
        `${this.getWebBaseUrl()}/account-link-conflict?token=${encodeURIComponent(
          rawToken,
        )}&provider=${this.getProviderSlug(provider)}&email=${encodeURIComponent(
          profile.email,
        )}`,
      );
      return;
    }

    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        username: await this.generateUniqueUsername(profile.email),
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

    await this.createSessionForUser(user, request, response);
    response.redirect(
      `${this.getWebBaseUrl()}${this.normalizeNextPath(payload.nextPath)}`,
    );
  }

  async resolveAccountLink(
    rawToken: string,
    request: Request,
    response: Response,
  ) {
    const tokenRecord = await this.consumeStoredToken(
      rawToken,
      AuthTokenType.ACCOUNT_LINK,
    );

    if (!tokenRecord.userId || !tokenRecord.payload) {
      throw new UnauthorizedException('Account link token is invalid.');
    }

    const payload = tokenRecord.payload as PendingAccountLinkPayload;
    const user = await this.linkProviderAccount(tokenRecord.userId, {
      provider: payload.provider,
      providerAccountId: payload.providerAccountId,
      email: payload.email,
      fullName: payload.fullName,
      avatarUrl: payload.avatarUrl,
    });

    await this.createSessionForUser(user, request, response);

    return {
      user,
      nextPath: this.normalizeNextPath(payload.nextPath),
    };
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

  private async createSessionForUser(
    user: AuthUser,
    request: Request,
    response: Response,
  ) {
    const refreshToken = this.createRawToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
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

  private async rotateSessionFromRefreshToken(
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
        refreshTokenHash: this.hashToken(refreshToken),
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

    const nextRefreshToken = this.createRawToken();
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(nextRefreshToken),
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
        secret: this.getAccessTokenSecret(),
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

  private async createStoredToken(args: {
    userId?: number;
    type: AuthTokenType;
    ttlMs: number;
    payload?: Prisma.InputJsonValue;
  }) {
    const rawToken = this.createRawToken();
    await this.prisma.authToken.create({
      data: {
        userId: args.userId,
        type: args.type,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + args.ttlMs),
        payload: args.payload,
      },
    });
    return { rawToken };
  }

  private async consumeStoredToken(rawToken: string, type: AuthTokenType) {
    const token = await this.prisma.authToken.findFirst({
      where: {
        tokenHash: this.hashToken(rawToken),
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

  private async linkProviderAccount(userId: number, profile: ProviderProfile) {
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

  private async fetchProviderProfile(
    provider: AuthProvider,
    code: string,
  ): Promise<ProviderProfile> {
    if (provider === AuthProvider.GITHUB) {
      return this.fetchGitHubProfile(code);
    }

    return this.fetchGoogleProfile(code);
  }

  private async fetchGitHubProfile(code: string): Promise<ProviderProfile> {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.getProviderClientId(AuthProvider.GITHUB),
          client_secret: this.getProviderClientSecret(AuthProvider.GITHUB),
          code,
          redirect_uri: `${this.getApiBaseUrl()}/auth/github/callback`,
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('GitHub authorization failed.');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenData.access_token) {
      throw new UnauthorizedException('GitHub did not return an access token.');
    }

    const [profileResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DevOverflow',
        },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DevOverflow',
        },
      }),
    ]);

    if (!profileResponse.ok || !emailsResponse.ok) {
      throw new UnauthorizedException('Unable to fetch GitHub profile.');
    }

    const profile = (await profileResponse.json()) as {
      id: number;
      name: string | null;
      avatar_url: string | null;
      email: string | null;
    };
    const emails = (await emailsResponse.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const primaryEmail =
      profile.email ??
      emails.find((item) => item.primary && item.verified)?.email ??
      emails.find((item) => item.verified)?.email;

    if (!primaryEmail) {
      throw new UnauthorizedException(
        'GitHub account must expose a verified email address.',
      );
    }

    return {
      provider: AuthProvider.GITHUB,
      providerAccountId: String(profile.id),
      email: this.normalizeEmail(primaryEmail),
      fullName: profile.name,
      avatarUrl: profile.avatar_url,
    };
  }

  private async fetchGoogleProfile(code: string): Promise<ProviderProfile> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.getProviderClientId(AuthProvider.GOOGLE),
        client_secret: this.getProviderClientSecret(AuthProvider.GOOGLE),
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${this.getApiBaseUrl()}/auth/google/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Google authorization failed.');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenData.access_token) {
      throw new UnauthorizedException('Google did not return an access token.');
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    if (!profileResponse.ok) {
      throw new UnauthorizedException('Unable to fetch Google profile.');
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.email || profile.email_verified === false) {
      throw new UnauthorizedException(
        'Google account must expose a verified email address.',
      );
    }

    return {
      provider: AuthProvider.GOOGLE,
      providerAccountId: profile.sub,
      email: this.normalizeEmail(profile.email),
      fullName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };
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

  private createRawToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeNextPath(next: string | undefined) {
    if (!next || !next.startsWith('/')) {
      return '/';
    }
    return next;
  }

  private toAuthUser(user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }

  private async generateUniqueUsername(email: string) {
    const base = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);

    const seed = base.length >= 3 ? base : `user_${base || 'account'}`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate =
        attempt === 0 ? seed : `${seed}_${randomBytes(2).toString('hex')}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Unable to reserve a username for that account.',
    );
  }

  private getAccessTokenSecret() {
    return process.env.JWT_SECRET ?? 'devoverflow-local-access-secret';
  }

  private getWebBaseUrl() {
    return process.env.WEB_APP_URL ?? 'http://localhost:3000';
  }

  private getApiBaseUrl() {
    return process.env.API_BASE_URL ?? 'http://localhost:3001';
  }

  private getProviderSlug(provider: AuthProvider) {
    return provider === AuthProvider.GITHUB ? 'github' : 'google';
  }

  private getProviderClientId(provider: AuthProvider) {
    return provider === AuthProvider.GITHUB
      ? (process.env.GITHUB_CLIENT_ID ?? '')
      : (process.env.GOOGLE_CLIENT_ID ?? '');
  }

  private getProviderClientSecret(provider: AuthProvider) {
    return provider === AuthProvider.GITHUB
      ? (process.env.GITHUB_CLIENT_SECRET ?? '')
      : (process.env.GOOGLE_CLIENT_SECRET ?? '');
  }

  private assertProviderIsConfigured(provider: AuthProvider) {
    if (
      !this.getProviderClientId(provider) ||
      !this.getProviderClientSecret(provider)
    ) {
      throw new ServiceUnavailableException(
        `${this.getProviderSlug(provider)} OAuth is not configured.`,
      );
    }
  }
}
