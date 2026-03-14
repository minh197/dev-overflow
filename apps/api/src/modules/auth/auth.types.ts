import type { Request } from 'express';
import type { AuthProvider } from '@prisma/client';

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
  authSessionId?: number;
};

export type ProviderProfile = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type PendingAccountLinkPayload = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  nextPath: string;
};
