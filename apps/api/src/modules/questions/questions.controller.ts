import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';
import { GetHotQuestionsQueryDto } from './dto/get-hot-questions-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionParamDto } from './dto/question-param.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  getQuestions(@Query() query: GetQuestionsQueryDto) {
    return this.questionsService.listQuestions(query);
  }

  @Get('hot')
  getHotQuestions(@Query() query: GetHotQuestionsQueryDto) {
    return this.questionsService.listHotQuestions(query);
  }

  @Get(':id')
  getQuestion(@Param() params: QuestionParamDto) {
    return this.questionsService.getQuestion(params.id);
  }

  @Post()
  createQuestion(@Body() body: CreateQuestionDto) {
    return this.questionsService.createQuestion(body);
  }

  @Patch(':id')
  updateQuestion(
    @Param() params: QuestionParamDto,
    @Body() body: UpdateQuestionDto,
  ) {
    return this.questionsService.updateQuestion(params.id, body);
  }

  @Delete(':id')
  deleteQuestion(@Param() params: QuestionParamDto) {
    return this.questionsService.deleteQuestion(params.id);
  }
}
