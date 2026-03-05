import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { InviteService, InviteDuration } from './invite.service';

@Controller('api/invites')
export class InviteController {
  constructor(private inviteService: InviteService) {}

  @Post('create')
  async createInvite(@Body() body: {
    roomName: string;
    createdBy: string;
    duration: InviteDuration;
    maxUses?: number;
    description?: string;
  }) {
    return await this.inviteService.createInvite(
      body.roomName,
      body.createdBy,
      body.duration,
      body.maxUses,
      body.description
    );
  }

  @Post(':code/use')
  async useInvite(
    @Param('code') code: string,
    @Body('username') username: string
  ) {
    return await this.inviteService.useInvite(code, username);
  }

  @Get('room/:roomName')
  async getRoomInvites(@Param('roomName') roomName: string) {
    return await this.inviteService.getRoomInvites(roomName);
  }

  @Get(':code')
  async getInvite(@Param('code') code: string) {
    return await this.inviteService.getInvite(code);
  }

  @Post(':code/deactivate')
  async deactivateInvite(
    @Param('code') code: string,
    @Body('username') username: string
  ) {
    return await this.inviteService.deactivateInvite(code, username);
  }

  @Delete(':code')
  async deleteInvite(
    @Param('code') code: string,
    @Body('username') username: string
  ) {
    return await this.inviteService.deleteInvite(code, username);
  }
}