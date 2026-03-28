import { IsIn } from 'class-validator';

export class CastVoteDto {
  /** 1 = upvote, -1 = downvote, 0 = remove vote */
  @IsIn([1, -1, 0])
  value!: 1 | -1 | 0;
}
