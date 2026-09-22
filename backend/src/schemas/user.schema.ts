// backend/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
  })
  username: string;

  @Prop({
    required: true,
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
  })
  email: string;

  @Prop({ required: true, minlength: 6 })
  password: string; // Should be hashed

  @Prop({ type: String, maxlength: 50 })
  displayName?: string;

  @Prop({ type: String, enum: ['male', 'female', 'other'], default: 'other' })
  gender: 'male' | 'female' | 'other';

  @Prop({ type: String, maxlength: 100 })
  country: string;

  @Prop({ type: String })
  avatar?: string; // URL or base64

  @Prop({ type: String })
  coverPhoto?: string; // URL or base64

  @Prop({ type: String, maxlength: 500 })
  bio?: string;

  @Prop({ type: Number, min: 13, max: 120 })
  age?: number;

  @Prop({ type: String, enum: ['online', 'offline', 'away', 'busy', 'dnd'], default: 'offline' })
  status: 'online' | 'offline' | 'away' | 'busy' | 'dnd';

  @Prop({ type: Date })
  lastSeen?: Date;

  // --- 🛡️ NEW: Global Moderation & Permissions ---
  @Prop({ type: String, enum: ['user', 'global_mod', 'admin'], default: 'user' })
  globalRole: 'user' | 'global_mod' | 'admin';

  @Prop({ default: false })
  isPlatformBanned: boolean;

  @Prop({ default: 3 })
  roomCreationLimit: number; // Max rooms a normal user can create
  // ----------------------------------------------

  @Prop({ type: [String], default: [] })
  blockedUsers: string[];

  @Prop({ type: Object, default: {} })
  preferences: {
    notifications: boolean;
    soundEnabled: boolean;
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
  };

  @Prop({ type: [String], default: [] })
  rooms: string[];

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isModerator: boolean; // Kept for your backward compatibility

  @Prop({ default: null, select: false })
  refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });