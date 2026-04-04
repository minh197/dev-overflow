import { createHash, randomBytes } from 'crypto';

export function createRawToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
