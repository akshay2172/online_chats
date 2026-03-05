// backend/schemas/friend-request.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FriendRequestDocument = FriendRequest & Document;

@Schema({ timestamps: true })
export class FriendRequest {
    @Prop({ required: true })
    from: string; // sender username

    @Prop({ required: true })
    to: string; // receiver username

    @Prop({ type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' })
    status: 'pending' | 'accepted' | 'rejected';
}

export const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);

// Indexes
FriendRequestSchema.index({ from: 1, to: 1 }, { unique: true });
FriendRequestSchema.index({ to: 1, status: 1 });
FriendRequestSchema.index({ from: 1, status: 1 });
