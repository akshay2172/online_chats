// backend/auth/auth.service.ts
import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';



  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async signup(userData: any) {
    const existingUsername = await this.userModel.findOne({ username: userData.username });
    if (existingUsername) {
      throw new BadRequestException('Username already exists. Please choose a different one.');
    }

    const existingEmail = await this.userModel.findOne({ email: userData.email });
    if (existingEmail) {
      throw new BadRequestException('Email is already registered.');
    }

    const hashedPassword = await this.hashPassword(userData.password);

    const user = new this.userModel({
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      displayName: userData.displayName || userData.username,
      gender: userData.gender,
      country: userData.country,
      bio: userData.bio,
      status: 'offline',
    });

    await user.save();

    return { message: 'User created successfully' };
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // 🚫 Block globally banned users — Owner is always exempt
    const isOwner = !!process.env.OWNER_ID && user.username === process.env.OWNER_ID;
    if (!isOwner && user.isPlatformBanned) {
      throw new ForbiddenException('Your account has been permanently banned from this platform.');
    }

    const accessToken = this.generateAccessToken(user._id.toString(), user.username, isOwner);
    const refreshToken = await this.generateRefreshToken(user._id.toString());

    return {
      accessToken,
      refreshToken,
      username: user.username,
      email: user.email,
      avatar: user.avatar || null,
      bio: user.bio || '',
      displayName: user.displayName || user.username,
      gender: user.gender || 'other',
      country: user.country || 'Unknown',
      isOwner, // UI-only hint; all real privilege checks are server-side
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // Increased from default 10
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(userId: string, username: string, isOwner = false): string {
    return jwt.sign(
      {
        userId,
        username,
        isOwner, // For frontend badge display only — never trusted server-side
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = jwt.sign(
      {
        userId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    // ✅ Store refresh token in Database instead of memory
    await this.userModel.findByIdAndUpdate(userId, { refreshToken });

    return refreshToken;
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async verifyRefreshToken(token: string, userId: string): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET);
      const user = await this.userModel.findById(userId).select('+refreshToken');
      return user?.refreshToken === token;
    } catch (error) {
      return false;
    }
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string) {
    try {
      if (!refreshToken) {
        console.warn('⚠️ Refresh attempt with no token');
        throw new UnauthorizedException('No refresh token provided');
      }

      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;
      const userId = decoded.userId;

      const user = await this.userModel.findById(userId).select('+refreshToken');
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Refresh token revoked or invalid');
      }

      // ✅ Check for owner status
      const isOwner = !!process.env.OWNER_ID && user.username === process.env.OWNER_ID;

      // Generate new access token
      const newAccessToken = this.generateAccessToken(userId, user.username, isOwner);
      console.log(`✅ Token refreshed successfully for ${user.username}`);

      return {
        accessToken: newAccessToken,
        username: user.username,
        email: user.email,
        isOwner,
      };
    } catch (error) {
      console.error('❌ refreshAccessToken error:', error.message);
      if (error instanceof UnauthorizedException || error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Logout - revoke refresh token
  async logout(userId: string): Promise<void> {
    await this.revokeRefreshToken(userId);
  }
}