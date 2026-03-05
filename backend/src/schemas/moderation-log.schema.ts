// backend/schemas/moderation-log.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ModerationLogDocument = ModerationLog & Document;

@Schema({ timestamps: true })
export class ModerationLog {
  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  moderator: string;

  @Prop({ required: true })
  targetUser: string;

  @Prop({ type: String })
  roomName?: string;

  @Prop({ type: String })
  reason?: string;
}

export const ModerationLogSchema = SchemaFactory.createForClass(ModerationLog);

// Add indexes for efficient querying
ModerationLogSchema.index({ roomName: 1, createdAt: -1 });
ModerationLogSchema.index({ targetUser: 1 });
ModerationLogSchema.index({ moderator: 1 });
