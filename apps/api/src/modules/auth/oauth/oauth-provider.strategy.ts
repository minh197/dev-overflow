import { AuthProvider } from '@prisma/client';
import type { ProviderProfile } from '../auth.types';
import { getProviderSlug } from '../auth-env';

export abstract class OAuthProviderStrategy {
  abstract readonly provider: AuthProvider;

  abstract buildAuthorizationUrl(state: string, redirectUri: string): string;

  abstract exchangeCodeForProfile(
    code: string,
    apiBaseUrl: string,
  ): Promise<ProviderProfile>;

  isConfigured(): boolean {
    return Boolean(this.getClientId() && this.getClientSecret());
  }

  getSlug(): string {
    return getProviderSlug(this.provider);
  }

  protected abstract getClientId(): string;
  protected abstract getClientSecret(): string;
}
