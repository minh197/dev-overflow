import { IsEnum, IsOptional } from 'class-validator';

export enum AnswerSort {
  UPVOTES = 'upvotes',
  NEWEST = 'newest',
}

export class GetQuestionQueryDto {
  @IsOptional()
  @IsEnum(AnswerSort)
  answerSort?: AnswerSort;
}
