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

export enum UserDirectorySort {
  popular = 'popular',
  reputation = 'reputation',
  moderators = 'moderators',
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(UserDirectorySort)
  sort?: UserDirectorySort;

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
