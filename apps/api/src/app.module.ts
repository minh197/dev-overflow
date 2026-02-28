import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { TagsModule } from './modules/tags/tags.module';
import { SearchModule } from './modules/search/search.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [PrismaModule, QuestionsModule, TagsModule, SearchModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
