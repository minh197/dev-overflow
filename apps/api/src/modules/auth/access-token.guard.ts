import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.authService.getAuthenticatedUserFromRequest(request);
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
    const request = context.switchToHttp().getRequest();
    request.user =
      (await this.authService.getAuthenticatedUserFromRequest(request, {
        required: false,
      })) ?? undefined;
    return true;
  }
}
