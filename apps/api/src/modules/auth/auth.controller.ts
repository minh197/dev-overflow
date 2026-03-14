import { AuthProvider } from '@prisma/client';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import {
  AuthProviderParamDto,
  OAuthCallbackQueryDto,
  OAuthQueryDto,
} from './dto/auth-provider-param.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResolveAccountLinkDto } from './dto/resolve-account-link.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import type { AuthUser } from './auth.types';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  signUp(
    @Body() body: SignUpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.signUp(body, request, response);
  }

  @Post('sign-in')
  signIn(
    @Body() body: SignInDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.signIn(body, request, response);
  }

  @Post('sign-out')
  signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.signOut(request, response);
  }

  @Post('refresh')
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.refresh(request, response);
  }

  @Get('me')
  getMe(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.getMe(request, response);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  resetPassword(
    @Body() body: ResetPasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.resetPassword(body, request, response);
  }

  @Post('link/resolve')
  resolveAccountLink(
    @Body() body: ResolveAccountLinkDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.resolveAccountLink(body.token, request, response);
  }

  @UseGuards(AccessTokenGuard)
  @Post('link/:provider')
  async linkProvider(
    @Param() params: AuthProviderParamDto,
    @CurrentUser() user: AuthUser,
    @Body() body: OAuthQueryDto,
  ) {
    return {
      authorizationUrl: await this.authService.buildProviderAuthorizationUrl(
        this.toProvider(params.provider),
        body.next,
        'link',
        user.id,
      ),
    };
  }

  @UseGuards(AccessTokenGuard)
  @Post('unlink/:provider')
  unlinkProvider(
    @Param() params: AuthProviderParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.unlinkProvider(user.id, this.toProvider(params.provider));
  }

  @Get(':provider')
  async beginProviderSignIn(
    @Param() params: AuthProviderParamDto,
    @Query() query: OAuthQueryDto,
    @Res() response: Response,
  ) {
    const authorizationUrl = await this.authService.buildProviderAuthorizationUrl(
      this.toProvider(params.provider),
      query.next,
      'sign-in',
    );

    response.redirect(authorizationUrl);
  }

  @Get(':provider/callback')
  async providerCallback(
    @Param() params: AuthProviderParamDto,
    @Query() query: OAuthCallbackQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    await this.authService.handleProviderCallback(
      this.toProvider(params.provider),
      query.code,
      query.state,
      request,
      response,
    );
  }

  private toProvider(provider: 'github' | 'google') {
    return provider === 'github' ? AuthProvider.GITHUB : AuthProvider.GOOGLE;
  }
}
