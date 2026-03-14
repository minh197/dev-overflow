import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user =
      await this.authService.getAuthenticatedUserFromRequest(request);
    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }
    request.user = user;
    return true;
  }
}

@Injectable()
export class OptionalAccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user =
      (await this.authService.getAuthenticatedUserFromRequest(request, {
        required: false,
      })) ?? undefined;
    return true;
  }
}
