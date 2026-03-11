// backend/schemas/dm-message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DMMessageDocument = DMMessage & Document & {
    createdAt: Date;
    updatedAt: Date;
};

@Schema({ timestamps: true })
export class DMMessage {
    @Prop({ required: true })
    conversationId: string;

    @Prop({ required: true })
    sender: string;

    @Prop({ required: true })
    receiver: string;

    @Prop({ required: true })
    message: string;

    @Prop({ type: String, default: 'text' })
    messageType: 'text' | 'image' | 'file' | 'voice' | 'gif' | 'sticker';

    @Prop({ type: Object })
    fileData?: {
        filename: string;
        originalName: string;
        mimetype: string;
        size: number;
        url: string;
    };

    @Prop({ type: Date })
    readAt?: Date;

    @Prop({ type: Date })
    deliveredAt?: Date;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop({ default: false })
    isPinned: boolean;

    @Prop({ default: false })
    isReported: boolean;

    @Prop({ type: String })
    editedMessage?: string;

    @Prop({ type: Date })
    editedAt?: Date;

    @Prop({ default: false })
    isEdited: boolean;

    @Prop({ type: String })
    replyTo?: string; // message ID

    @Prop({ type: Object })
    replyToMessage?: { sender: string; message: string; messageId: string };

    @Prop({ type: [{ emoji: String, users: [String] }], default: [] })
    reactions: Array<{ emoji: string; users: string[] }>;
}

export const DMMessageSchema = SchemaFactory.createForClass(DMMessage);

// Indexes
DMMessageSchema.index({ conversationId: 1, createdAt: -1 });
DMMessageSchema.index({ sender: 1 });
DMMessageSchema.index({ receiver: 1 });
