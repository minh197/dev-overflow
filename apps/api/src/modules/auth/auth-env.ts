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

export function getProviderClientId(provider: AuthProvider) {
  if (provider === AuthProvider.GITHUB) {
    return process.env.GITHUB_CLIENT_ID ?? process.env.GITHUB_ID ?? '';
  }

  return process.env.GOOGLE_CLIENT_ID ?? '';
}

export function getProviderClientSecret(provider: AuthProvider) {
  if (provider === AuthProvider.GITHUB) {
    return process.env.GITHUB_CLIENT_SECRET ?? process.env.GITHUB_SECRET ?? '';
  }

  return process.env.GOOGLE_CLIENT_SECRET ?? '';
}
