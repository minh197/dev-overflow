import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  bodyMdx!: string;
}
