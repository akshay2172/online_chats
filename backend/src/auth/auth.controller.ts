import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: any) {
    return await this.authService.signup(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return await this.authService.login(body.email, body.password);
  }
}