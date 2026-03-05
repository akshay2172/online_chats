// backend/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from '../schemas/notification.schema';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(Notification.name)
        private notificationModel: Model<NotificationDocument>,
    ) { }

    // Create a notification
    async createNotification(data: {
        recipientUsername: string;
        type: NotificationType;
        title: string;
        message: string;
        data?: any;
        actionUrl?: string;
        expiresAt?: Date;
    }): Promise<NotificationDocument> {
        const notification = new this.notificationModel(data);
        return await notification.save();
    }

    // Get notifications for a user
    async getNotifications(
        username: string,
        options: {
            unreadOnly?: boolean;
            limit?: number;
            skip?: number;
        } = {}
    ): Promise<NotificationDocument[]> {
        const { unreadOnly = false, limit = 50, skip = 0 } = options;

        const query: any = {
            recipientUsername: username,
            isDeleted: false,
        };

        if (unreadOnly) {
            query.isRead = false;
        }

        return await this.notificationModel
            .find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .exec();
    }

    // Get unread count
    async getUnreadCount(username: string): Promise<number> {
        return await this.notificationModel.countDocuments({
            recipientUsername: username,
            isRead: false,
            isDeleted: false,
        });
    }

    // Mark notification as read
    async markAsRead(notificationId: string): Promise<NotificationDocument | null> {
        return await this.notificationModel
            .findByIdAndUpdate(
                notificationId,
                { isRead: true, readAt: new Date() },
                { new: true }
            )
            .exec();
    }

    // Mark all notifications as read
    async markAllAsRead(username: string): Promise<void> {
        await this.notificationModel.updateMany(
            { recipientUsername: username, isRead: false },
            { isRead: true, readAt: new Date() }
        );
    }

    // Delete notification
    async deleteNotification(notificationId: string): Promise<void> {
        await this.notificationModel
            .findByIdAndUpdate(notificationId, { isDeleted: true })
            .exec();
    }

    // Delete all notifications for a user
    async deleteAllNotifications(username: string): Promise<void> {
        await this.notificationModel.updateMany(
            { recipientUsername: username },
            { isDeleted: true }
        );
    }

    // Helper: Create mention notification
    async createMentionNotification(
        recipientUsername: string,
        mentionedBy: string,
        room: string,
        messageId: string,
        messagePreview: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'mention',
            title: 'You were mentioned',
            message: `@${mentionedBy} mentioned you in ${room}: "${messagePreview.substring(0, 50)}..."`,
            data: { messageId, room, mentionedBy },
            actionUrl: `/room/${room}?message=${messageId}`,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create room invite notification
    async createRoomInviteNotification(
        recipientUsername: string,
        invitedBy: string,
        roomName: string,
        inviteId: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'room_invite',
            title: 'Room invitation',
            message: `${invitedBy} invited you to join ${roomName}`,
            data: { inviteId, roomName, invitedBy },
            actionUrl: `/invite/${inviteId}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create kicked notification
    async createKickedNotification(
        recipientUsername: string,
        kickedBy: string,
        room: string,
        reason?: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'kicked',
            title: 'You were kicked',
            message: `You were kicked from ${room} by ${kickedBy}${reason ? `: ${reason}` : ''}`,
            data: { room, kickedBy, reason },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create banned notification
    async createBannedNotification(
        recipientUsername: string,
        bannedBy: string,
        room: string,
        reason?: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'banned',
            title: 'You were banned',
            message: `You were banned from ${room} by ${bannedBy}${reason ? `: ${reason}` : ''}`,
            data: { room, bannedBy, reason },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create muted notification
    async createMutedNotification(
        recipientUsername: string,
        mutedBy: string,
        room: string,
        reason?: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'muted',
            title: 'You were muted',
            message: `You were muted in ${room} by ${mutedBy}${reason ? `: ${reason}` : ''}`,
            data: { room, mutedBy, reason },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create promoted notification
    async createPromotedNotification(
        recipientUsername: string,
        promotedBy: string,
        room: string,
        newRole: 'moderator'  // Room Admin no longer exists in the hierarchy
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'promoted',
            title: 'You were promoted',
            message: `You were promoted to ${newRole} in ${room} by ${promotedBy}`,
            data: { room, promotedBy, newRole },
            actionUrl: `/room/${room}`,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create system error notification
    async createSystemErrorNotification(
        recipientUsername: string,
        errorMessage: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'system_error',
            title: 'System Error',
            message: errorMessage,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    // Cleanup old notifications (run as cron job)
    async cleanupOldNotifications(): Promise<number> {
        const result = await this.notificationModel.deleteMany({
            expiresAt: { $lt: new Date() },
        });
        return result.deletedCount;
    }
}
