import { config } from 'dotenv';
import { resolve } from 'path';

// Load root .env so DATABASE_URL and other vars are available (e.g. when using shared .env from monorepo root)
config({ path: resolve(process.cwd(), '../../.env') });
config(); // then apps/api/.env if present

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const rawOrigins =
    process.env.CORS_ORIGIN?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  const corsOrigin =
    rawOrigins.length > 1 ? rawOrigins : rawOrigins[0] ?? DEFAULT_WEB_ORIGIN;

  // Explicit methods (string) + headers so browser preflight allows PATCH/DELETE
  // with credentialed JSON requests from the web app.
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
    maxAge: 86_400,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Strip unknown keys without 400 (OAuth callbacks may include extra query params).
      forbidNonWhitelisted: false,
    }),
  );
  const parsedPort = parseInt(process.env.PORT ?? '3001', 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 3001;
  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
