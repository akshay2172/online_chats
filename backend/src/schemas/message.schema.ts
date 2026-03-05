// backend/schemas/message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  room: string;

  @Prop({ required: true })
  sender: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String })
  editedMessage?: string;

  @Prop({ type: Date })
  editedAt?: Date;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ type: [{ emoji: String, users: [String] }], default: [] })
  reactions: Array<{ emoji: string; users: string[] }>;

  @Prop({ type: String })
  replyTo?: string;

  @Prop({ type: Object })
  replyToMessage?: { sender: string; message: string; messageId: string };

  @Prop({ default: false })
  isReported: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: [String], default: [] })
  readBy: string[];

  @Prop({ type: String })
  messageType: 'text' | 'file' | 'image' | 'voice';

  @Prop({ type: Object })
  fileData?: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
  };

  @Prop({ type: [String], default: [] })
  mentions: string[];

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ type: String })
  threadId?: string;

  @Prop({ type: Number, default: 0 })
  threadCount: number;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add indexes for better query performance
MessageSchema.index({ room: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ mentions: 1 });
MessageSchema.index({ threadId: 1 });