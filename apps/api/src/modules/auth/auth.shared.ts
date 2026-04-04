import { Prisma } from '@prisma/client';
import type { AuthUser } from './auth.types';

export const authUserSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeNextPath(next: string | undefined) {
  if (!next || !next.startsWith('/')) {
    return '/';
  }
  return next;
}

export function toAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
  };
}
