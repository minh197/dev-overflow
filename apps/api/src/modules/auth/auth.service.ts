import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  getMe() {
    return { message: 'TODO: implement GET /auth/me' };
  }
}
