import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('api/notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get(':username')
  async getNotifications(@Param('username') username: string) {
    const notifications = await this.notificationService.getNotifications(username);
    const unreadCount = await this.notificationService.getUnreadCount(username);
    return { notifications, unreadCount };
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string) {
    return await this.notificationService.markAsRead(id);
  }

  @Post(':username/read-all')
  async markAllAsRead(@Param('username') username: string) {
    await this.notificationService.markAllAsRead(username);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    await this.notificationService.deleteNotification(id);
    return { success: true };
  }
}