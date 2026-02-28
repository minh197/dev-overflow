import { config } from 'dotenv';
import { resolve } from 'path';

// Load root .env so DATABASE_URL and other vars are available (e.g. when using shared .env from monorepo root)
config({ path: resolve(process.cwd(), '../../.env') });
config(); // then apps/api/.env if present

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
