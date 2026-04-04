import { AuthProvider } from '@prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getProviderClientId, getProviderClientSecret } from '../auth-env';
import { normalizeEmail } from '../auth.shared';
import type { ProviderProfile } from '../auth.types';
import { OAuthProviderStrategy } from './oauth-provider.strategy';

@Injectable()
export class GitHubOAuthProvider extends OAuthProviderStrategy {
  readonly provider = AuthProvider.GITHUB;

  protected getClientId() {
    return getProviderClientId(AuthProvider.GITHUB);
  }

  protected getClientSecret() {
    return getProviderClientSecret(AuthProvider.GITHUB);
  }

  buildAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams();
    params.set('client_id', this.getClientId());
    params.set('redirect_uri', redirectUri);
    params.set('state', state);
    params.set('scope', 'read:user user:email');
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForProfile(
    code: string,
    apiBaseUrl: string,
  ): Promise<ProviderProfile> {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.getClientId(),
          client_secret: this.getClientSecret(),
          code,
          redirect_uri: `${apiBaseUrl}/auth/github/callback`,
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
      email: normalizeEmail(primaryEmail),
      fullName: profile.name,
      avatarUrl: profile.avatar_url,
    };
  }
}
