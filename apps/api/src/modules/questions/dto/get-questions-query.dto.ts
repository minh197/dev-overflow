import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum QuestionsSort {
  NEWEST = 'newest',
  RECOMMENDED = 'recommended',
  FREQUENT = 'frequent',
  UNANSWERED = 'unanswered',
}

export class GetQuestionsQueryDto {
  @IsOptional()
  @IsEnum(QuestionsSort)
  sort?: QuestionsSort;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsArray()
  where?: string;

  @IsOptional()
  @IsArray()
  orderby?: string;

  @IsOptional()
  @IsArray()
  select?: string;


  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // [REVIEW] chưa thấy được sử dụng
  @IsOptional()
  @IsString()
  cursorCreatedAt?: string;

  // [REVIEW] chưa thấy được sử dụng
  @IsOptional()
  @IsString()
  cursorPostId?: string;
}
