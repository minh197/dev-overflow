import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PostsService } from './posts.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { PostParamDto } from './dto/post-param.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(AccessTokenGuard)
  @Post(':id/vote')
  castVote(
    @Param() params: PostParamDto,
    @Body() body: CastVoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.castVote(params.id, user, body);
  }
}
