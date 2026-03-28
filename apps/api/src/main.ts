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
  const configured = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [];
  const corsOrigin =
    configured.length > 1 ? configured : configured[0] ?? DEFAULT_WEB_ORIGIN;
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const parsedPort = parseInt(process.env.PORT ?? '3001', 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 3001;
  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
