import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenGuard,
  OptionalAccessTokenGuard,
} from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { QuestionsService } from './questions.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';
import { GetHotQuestionsQueryDto } from './dto/get-hot-questions-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionParamDto } from './dto/question-param.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { GetQuestionQueryDto } from './dto/get-question-query.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @UseGuards(OptionalAccessTokenGuard)
  @Get()
  getQuestions(
    @Query() query: GetQuestionsQueryDto,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.questionsService.listQuestions(query, user);
  }

  @Get('hot')
  getHotQuestions(@Query() query: GetHotQuestionsQueryDto) {
    return this.questionsService.listHotQuestions(query);
  }

  @UseGuards(OptionalAccessTokenGuard)
  @Get(':id')
  getQuestion(
    @Param() params: QuestionParamDto,
    @Query() query: GetQuestionQueryDto,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.questionsService.getQuestion(params.id, user, query);
  }

  @UseGuards(AccessTokenGuard)
  @Post(':id/answers')
  createAnswer(
    @Param() params: QuestionParamDto,
    @Body() body: CreateAnswerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionsService.createAnswer(params.id, user, body);
  }

  @UseGuards(AccessTokenGuard)
  @Post()
  createQuestion(
    @Body() body: CreateQuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionsService.createQuestion(user, body);
  }

  @UseGuards(AccessTokenGuard)
  @Patch(':id')
  updateQuestion(
    @Param() params: QuestionParamDto,
    @Body() body: UpdateQuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionsService.updateQuestion(params.id, user, body);
  }

  @UseGuards(AccessTokenGuard)
  @Delete(':id')
  deleteQuestion(
    @Param() params: QuestionParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionsService.deleteQuestion(params.id, user);
  }
}
