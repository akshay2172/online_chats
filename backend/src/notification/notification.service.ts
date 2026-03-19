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
    async markAsRead(notificationId: string, username: string): Promise<NotificationDocument | null> {
        return await this.notificationModel
            .findOneAndUpdate(
                { _id: notificationId, recipientUsername: username },
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
    async deleteNotification(notificationId: string, username: string): Promise<void> {
        await this.notificationModel
            .findOneAndUpdate(
                { _id: notificationId, recipientUsername: username },
                { isDeleted: true }
            )
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
        newRole: 'admin' | 'moderator' | 'member' | 'admin_removed'
    ): Promise<NotificationDocument> {
        let title = 'You were promoted';
        let message = `You were promoted to ${newRole} in ${room} by ${promotedBy}`;
        
        if (newRole === 'admin_removed') {
            title = 'Admin Status Removed';
            message = `Your global admin status was removed by ${promotedBy}`;
        } else if (newRole === 'member') {
            title = 'Role Changed';
            message = `Your role in ${room} was changed to member by ${promotedBy}`;
        }

        return this.createNotification({
            recipientUsername,
            type: 'promoted',
            title,
            message,
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

    // Helper: Create unbanned notification
    async createUnbannedNotification(
        recipientUsername: string,
        room: string,
        unbannedBy: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'unbanned',
            title: 'You were unbanned',
            message: `You were unbanned from ${room} by ${unbannedBy}`,
            data: { room, unbannedBy },
            actionUrl: `/room/${room}`,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create friend request notification
    async createFriendRequestNotification(
        recipientUsername: string,
        fromUsername: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'friend_request',
            title: 'New Friend Request',
            message: `${fromUsername} sent you a friend request`,
            data: { fromUsername },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create friend accepted notification
    async createFriendAcceptedNotification(
        recipientUsername: string,
        fromUsername: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            message: `${fromUsername} accepted your friend request`,
            data: { fromUsername },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create DM received notification
    async createDMReceivedNotification(
        recipientUsername: string,
        fromUsername: string,
        conversationId: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'dm_received',
            title: 'New Direct Message',
            message: `You received a new message from ${fromUsername}`,
            data: { fromUsername, conversationId },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }

    // Helper: Create platform banned notification
    async createPlatformBannedNotification(
        recipientUsername: string,
        bannedBy: string,
        reason?: string
    ): Promise<NotificationDocument> {
        return this.createNotification({
            recipientUsername,
            type: 'platform_banned',
            title: 'Account Banned',
            message: `Your account was banned by ${bannedBy}${reason ? ` for: ${reason}` : ''}`,
            data: { bannedBy, reason },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
