import { AuthProvider } from '@prisma/client';

export function getAccessTokenSecret() {
  return process.env.JWT_SECRET ?? 'devoverflow-local-access-secret';
}

export function getWebBaseUrl() {
  return process.env.WEB_APP_URL ?? 'http://localhost:3000';
}

/** Public API origin for OAuth callbacks — no trailing slash (Google/GitHub match redirect_uri exactly). */
export function getApiBaseUrl() {
  const base = process.env.API_BASE_URL ?? 'http://localhost:3001';
  return base.replace(/\/+$/, '');
}

export function getProviderSlug(provider: AuthProvider) {
  return provider === AuthProvider.GITHUB ? 'github' : 'google';
}
