// backend/schemas/dm-conversation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DMConversationDocument = DMConversation & Document;

@Schema({ timestamps: true })
export class DMConversation {
    @Prop({ type: [String], required: true })
    participants: string[]; // exactly 2 usernames

    @Prop({ type: String, default: '' })
    lastMessage: string;

    @Prop({ type: String })
    lastMessageSender?: string;

    @Prop({ type: Date, default: Date.now })
    lastMessageAt: Date;

    @Prop({ type: [String], default: [] })
    deletedBy: string[]; // per-user soft delete

    @Prop({ type: Map, of: Number, default: new Map() })
    unreadCount: Map<string, number>;
}

export const DMConversationSchema = SchemaFactory.createForClass(DMConversation);

// Indexes
DMConversationSchema.index({ participants: 1 });
DMConversationSchema.index({ lastMessageAt: -1 });
