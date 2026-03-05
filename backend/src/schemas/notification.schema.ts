// backend/schemas/notification.schema.ts
// Based on Product Decision: Mentions + Room Invites + System Alerts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document & {
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationType =
  | 'mention'           // User was mentioned in a message
  | 'room_invite'       // User was invited to a room
  | 'kicked'            // User was kicked from a room
  | 'banned'            // User was banned from a room
  | 'unbanned'          // User was unbanned from a room
  | 'muted'             // User was muted in a room
  | 'promoted'          // User was promoted to moderator
  | 'system_error';     // System error notification

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipientUsername: string; // Who receives this notification

  @Prop({ required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string; // e.g., "You were mentioned"

  @Prop({ required: true })
  message: string; // e.g., "@john mentioned you in general chat"

  @Prop({ type: Object })
  data?: {
    // For mentions
    messageId?: string;
    room?: string;
    mentionedBy?: string;

    // For room invites
    inviteId?: string;
    roomName?: string;
    invitedBy?: string;

    // For kicks/bans
    kickedBy?: string;
    bannedBy?: string;
    reason?: string;

    // For promotions
    newRole?: 'moderator';
    promotedBy?: string;

    // For mutes
    mutedBy?: string;

    // Generic
    [key: string]: any;
  };

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: String })
  actionUrl?: string; // Link to jump to message/room

  @Prop({ type: Date })
  expiresAt?: Date; // Optional: auto-delete old notifications
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes for performance
NotificationSchema.index({ recipientUsername: 1, createdAt: -1 });
NotificationSchema.index({ recipientUsername: 1, isRead: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index