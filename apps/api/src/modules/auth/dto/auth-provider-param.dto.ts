import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

const authProviders = ['github', 'google'] as const;

export class AuthProviderParamDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(authProviders)
  provider!: (typeof authProviders)[number];
}

export class OAuthQueryDto {
  @IsOptional()
  @IsString()
  next?: string;
}

export class OAuthCallbackQueryDto extends OAuthQueryDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}
