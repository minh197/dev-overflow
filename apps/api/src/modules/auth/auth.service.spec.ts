import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const request = {
    headers: {
      'user-agent': 'jest',
    },
    ip: '127.0.0.1',
  } as Request;

  const makeResponse = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    }) as unknown as Response;

  const makePrismaMock = () => ({
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    authToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (operations) => Promise.all(operations)),
  });

  const makeJwtServiceMock = () => ({
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
  });

  afterEach(() => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  it('creates a local user account during sign up', async () => {
    const prisma = makePrismaMock();
    const jwtService = makeJwtServiceMock();

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 7,
      email: 'student@example.com',
      username: 'student',
      fullName: null,
      avatarUrl: null,
    });
    const service = new AuthService(prisma as never, jwtService as never);

    const result = await service.signUp({
      username: 'student',
      email: 'Student@Example.com',
      password: 'Password123!',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: 'student@example.com',
          username: 'student',
        },
      }),
    );
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      user: {
        id: 7,
        email: 'student@example.com',
        username: 'student',
        fullName: null,
        avatarUrl: null,
      },
    });
  });

  it('returns a development reset URL when requesting a password reset', async () => {
    process.env.NODE_ENV = 'test';

    const prisma = makePrismaMock();
    const jwtService = makeJwtServiceMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      email: 'reset@example.com',
      status: UserStatus.ACTIVE,
    });

    const service = new AuthService(prisma as never, jwtService as never);
    const result = await service.forgotPassword({ email: 'reset@example.com' });

    expect(prisma.authToken.create).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.email).toBe('reset@example.com');
    expect(result.resetUrl).toContain('/reset-password/');
  });

  it('rejects unlinking the last available auth method', async () => {
    const prisma = makePrismaMock();
    const jwtService = makeJwtServiceMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 8,
      passwordHash: null,
      accounts: [
        {
          id: 11,
          provider: AuthProvider.GITHUB,
        },
      ],
    });

    const service = new AuthService(prisma as never, jwtService as never);

    await expect(
      service.unlinkProvider(8, AuthProvider.GITHUB),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails sign in when the password does not match', async () => {
    const prisma = makePrismaMock();
    const jwtService = makeJwtServiceMock();
    const response = makeResponse();

    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      email: 'student@example.com',
      username: 'student',
      fullName: null,
      avatarUrl: null,
      passwordHash:
        '$2b$10$Kl35MOHBglC6mLztVPKWWOo/2T4/eGUa31esKPXcztIaruCdVMYOW',
      status: UserStatus.ACTIVE,
    });

    const service = new AuthService(prisma as never, jwtService as never);

    await expect(
      service.signIn(
        {
          email: 'student@example.com',
          password: 'wrong-password',
        },
        request,
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires provider credentials before building an OAuth URL', async () => {
    const prisma = makePrismaMock();
    const jwtService = makeJwtServiceMock();
    const service = new AuthService(prisma as never, jwtService as never);

    await expect(
      service.buildProviderAuthorizationUrl(
        AuthProvider.GITHUB,
        '/',
        'sign-in',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
