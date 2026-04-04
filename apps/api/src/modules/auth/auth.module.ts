import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import {
  AccessTokenGuard,
  OptionalAccessTokenGuard,
} from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule, SearchModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, OptionalAccessTokenGuard],
  exports: [AuthService, AccessTokenGuard, OptionalAccessTokenGuard],
})
export class AuthModule {}
