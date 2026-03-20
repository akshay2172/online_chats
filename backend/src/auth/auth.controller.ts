import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('signup')
  async signup(@Body() body: SignupDto) {
    return await this.authService.signup(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return await this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  async refreshAccessToken(@Body() body: { refreshToken: string }) {
    return await this.authService.refreshAccessToken(body.refreshToken);
  }

  @Post('logout')
  async logout(@Body() body: { userId: string }) {
    await this.authService.logout(body.userId);
    return { message: 'Logged out successfully' };
  }

  // --- 📧 EMAIL OTP ENDPOINTS ---
  
  @Post('send-otp')
  async sendOtp(@Body() body: { userId: string }) {
    return await this.authService.generateAndSendOtp(body.userId);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { userId: string; otp: string }) {
    return await this.authService.verifyOtp(body.userId, body.otp);
  }

  @Post('resend-otp')
  async resendOtp(@Body() body: { userId: string }) {
    return await this.authService.resendOtp(body.userId);
  }
}