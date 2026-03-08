import { Controller, Get, Post, Delete, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) { }

  @Get(':username')
  async getNotifications(@Param('username') username: string, @Req() req: any) {
    if (req.user.username !== username) {
      throw new ForbiddenException('You can only access your own notifications.');
    }
    const notifications = await this.notificationService.getNotifications(username);
    const unreadCount = await this.notificationService.getUnreadCount(username);
    return { notifications, unreadCount };
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return await this.notificationService.markAsRead(id, req.user.username);
  }

  @Post(':username/read-all')
  async markAllAsRead(@Param('username') username: string, @Req() req: any) {
    if (req.user.username !== username) {
      throw new ForbiddenException('You can only access your own notifications.');
    }
    await this.notificationService.markAllAsRead(username);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Req() req: any) {
    await this.notificationService.deleteNotification(id, req.user.username);
    return { success: true };
  }
}
