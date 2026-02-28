import { Controller, Get, Query } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';
import { GetHotQuestionsQueryDto } from './dto/get-hot-questions-query.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  getQuestions(@Query() _query: GetQuestionsQueryDto) {
    return this.questionsService.listQuestions();
  }

  @Get('hot')
  getHotQuestions(@Query() _query: GetHotQuestionsQueryDto) {
    return this.questionsService.listHotQuestions();
  }
}
