import { AuthProvider } from '@prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getProviderClientId, getProviderClientSecret } from '../auth-env';
import { normalizeEmail } from '../auth.shared';
import type { ProviderProfile } from '../auth.types';
import { OAuthProviderStrategy } from './oauth-provider.strategy';

@Injectable()
export class GoogleOAuthProvider extends OAuthProviderStrategy {
  readonly provider = AuthProvider.GOOGLE;

  protected getClientId() {
    return getProviderClientId(AuthProvider.GOOGLE);
  }

  protected getClientSecret() {
    return getProviderClientSecret(AuthProvider.GOOGLE);
  }

  buildAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams();
    params.set('client_id', this.getClientId());
    params.set('redirect_uri', redirectUri);
    params.set('state', state);
    params.set('response_type', 'code');
    params.set('scope', 'openid email profile');
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForProfile(
    code: string,
    apiBaseUrl: string,
  ): Promise<ProviderProfile> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${apiBaseUrl}/auth/google/callback`,
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
      email: normalizeEmail(profile.email),
      fullName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };
  }
}
