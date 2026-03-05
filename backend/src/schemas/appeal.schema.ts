// backend/src/schemas/appeal.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppealDocument = Appeal & Document;

export type AppealStatus = 'pending' | 'approved' | 'rejected';

@Schema({ timestamps: true })
export class Appeal {
    /** Username of the banned user submitting the appeal */
    @Prop({ required: true, index: true })
    username: string;

    /** The user's explanation of why they should be unbanned */
    @Prop({ required: true })
    reason: string;

    /** Current status of the appeal */
    @Prop({ type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
    status: AppealStatus;

    /** Who originally issued the global ban (from moderation log) */
    @Prop({ type: String })
    bannedBy?: string;

    /** Admin who reviewed and made a decision */
    @Prop({ type: String })
    reviewedBy?: string;

    /** When the review decision was made */
    @Prop({ type: Date })
    reviewedAt?: Date;

    /** Admin's note / reason for approving or rejecting */
    @Prop({ type: String })
    adminNote?: string;
}

export const AppealSchema = SchemaFactory.createForClass(Appeal);

AppealSchema.index({ username: 1 });
AppealSchema.index({ status: 1 });
AppealSchema.index({ createdAt: -1 });
