import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UsernameReservationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniqueUsername(email: string) {
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
}
