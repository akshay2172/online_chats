// backend/schemas/room-ban.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomBanDocument = RoomBan & Document;

@Schema({ timestamps: true })
export class RoomBan {
    @Prop({ required: true })
    roomName: string;

    @Prop({ required: true })
    username: string;

    @Prop({ required: true })
    bannedBy: string;

    @Prop()
    reason?: string;

    @Prop({ type: String, enum: ['temporary', 'permanent'], default: 'permanent' })
    banType: 'temporary' | 'permanent';

    @Prop()
    expiresAt?: Date;

    @Prop({ default: true })
    isActive: boolean;
}

export const RoomBanSchema = SchemaFactory.createForClass(RoomBan);

RoomBanSchema.index({ roomName: 1, username: 1 });
RoomBanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RoomBanSchema.index({ isActive: 1 });
