import { Controller, Post, Body, Res, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 15 * 60 * 1000, // 15 mins
};

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('signup')
  async signup(@Body() body: SignupDto) {
    return await this.authService.signup(body);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(body.email, body.password);
    
    // Set httpOnly cookies
    res.cookie('accessToken', data.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return data;
  }

  @Post('refresh')
  async refreshAccessToken(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken || body?.refreshToken;
    const data = await this.authService.refreshAccessToken(refreshToken);

    // Set updated accessToken cookie
    res.cookie('accessToken', data.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);

    return data;
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Body() body: { userId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = (req as any).user?.userId || body?.userId;
    if (userId) {
      await this.authService.logout(userId);
    }
    
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return { message: 'Logged out successfully' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: any,
    @Body() body: { oldPassword?: string; currentPassword?: string; newPassword: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.userId;
    const oldPass = body.oldPassword || body.currentPassword || '';
    const result = await this.authService.changePassword(userId, oldPass, body.newPassword);

    // Clear cookies after password change so user re-authenticates
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return result;
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