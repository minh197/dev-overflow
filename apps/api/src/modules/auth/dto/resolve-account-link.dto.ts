import { IsString } from 'class-validator';

export class ResolveAccountLinkDto {
  @IsString()
  token!: string;
}
