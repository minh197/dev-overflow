import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum TagsListSort {
  popular = 'popular',
  name = 'name',
}

export class ListTagsQueryDto {
  @IsOptional()
  @IsEnum(TagsListSort)
  sort?: TagsListSort;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
