import { config } from 'dotenv';
import { resolve } from 'path';

// Load root .env so DATABASE_URL and other vars are available (e.g. when using shared .env from monorepo root)
config({ path: resolve(process.cwd(), '../../.env') });
config(); // then apps/api/.env if present

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Browsers send `Origin: <web app>` (e.g. :3000). CORS must allow that origin — not the API (:3001).
 * We always include WEB_APP_URL (same default as auth redirects) and union with CORS_ORIGIN so a
 * single mistaken entry (like the API URL) cannot lock out the real frontend.
 */
function corsAllowedOrigins(): string[] {
  const web = normalizeOrigin(process.env.WEB_APP_URL ?? DEFAULT_WEB_ORIGIN);
  const extra =
    process.env.CORS_ORIGIN?.split(',')
      .map((o) => normalizeOrigin(o))
      .filter(Boolean) ?? [];

  const merged = [web, ...extra];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of merged) {
    if (!seen.has(o)) {
      seen.add(o);
      out.push(o);
    }
  }
  return out;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Explicit methods (string) + headers so browser preflight allows PATCH/DELETE
  // with credentialed JSON requests from the web app.
  app.enableCors({
    origin: corsAllowedOrigins(),
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
