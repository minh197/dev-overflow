import { Injectable } from '@nestjs/common';

@Injectable()
export class QuestionsService {
  listQuestions() {
    return { message: 'TODO: implement GET /questions' };
  }

  listHotQuestions() {
    return { message: 'TODO: implement GET /questions/hot' };
  }
}
