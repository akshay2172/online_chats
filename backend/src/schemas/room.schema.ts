// backend/schemas/room.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  createdBy: string;

  @Prop({ type: [String], default: [] })
  members: string[];

  @Prop({ type: [String], default: [] })
  moderators: string[];

  @Prop({ type: [String], default: [] })
  bannedUsers: string[];

  @Prop({ type: [String], default: [] })
  mutedUsers: string[];

  @Prop({ type: String, enum: ['public', 'private'], default: 'public' })
  type: 'public' | 'private';


  @Prop({ type: String })
  avatar?: string;

  @Prop({ type: [String], default: [] })
  pinnedMessages: string[];

  @Prop({ type: Object, default: {} })
  settings: {
    allowFileSharing: boolean;
    allowVoiceMessages: boolean;
    maxFileSize: number; // in MB
    muteNotifications: boolean;
    slowMode: number; // seconds between messages
  };

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Add indexes
RoomSchema.index({ name: 1 });
RoomSchema.index({ members: 1 });
RoomSchema.index({ type: 1 });
RoomSchema.index({ isActive: 1 });