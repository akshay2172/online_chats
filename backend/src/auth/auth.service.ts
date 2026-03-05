// backend/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
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

  // Store refresh tokens (use Redis in production)
  private refreshTokens: Map<string, string> = new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async signup(userData: any) {
    const existingUser = await this.userModel.findOne({
      $or: [{ email: userData.email }, { username: userData.username }]
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await this.hashPassword(userData.password);

    const user = new this.userModel({
      ...userData,
      password: hashedPassword,
      status: 'offline',
    });

    await user.save();

    return { message: 'User created successfully' };
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    // 🚫 Block globally banned users — Owner is always exempt
    const isOwner = !!process.env.OWNER_ID && user.username === process.env.OWNER_ID;
    if (!isOwner && user.isPlatformBanned) {
      throw new Error('Your account has been permanently banned from this platform.');
    }

    const accessToken = this.generateAccessToken(user._id.toString(), user.username, isOwner);
    const refreshToken = this.generateRefreshToken(user._id.toString());

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

  generateRefreshToken(userId: string): string {
    const refreshToken = jwt.sign(
      {
        userId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token
    this.refreshTokens.set(userId, refreshToken);
    return refreshToken;
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  verifyRefreshToken(token: string, userId: string): boolean {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET);
      return this.refreshTokens.get(userId) === token;
    } catch (error) {
      return false;
    }
  }

  revokeRefreshToken(userId: string): void {
    this.refreshTokens.delete(userId);
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const userId = decoded.userId;

      // Verify token exists in store
      if (this.refreshTokens.get(userId) !== refreshToken) {
        throw new Error('Refresh token revoked or invalid');
      }

      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(userId, user.username);

      return {
        accessToken: newAccessToken,
        username: user.username,
        email: user.email,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Logout - revoke refresh token
  logout(userId: string): void {
    this.revokeRefreshToken(userId);
  }
}