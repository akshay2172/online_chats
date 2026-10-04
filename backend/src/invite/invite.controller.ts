import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { InviteService, InviteDuration } from './invite.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

@Controller('api/invites')
export class InviteController {
  constructor(private inviteService: InviteService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createInvite(@Body() body: {
    roomName: string;
    duration: InviteDuration;
    maxUses?: number;
    description?: string;
  }, @Req() req: AuthenticatedRequest) {
    const createdBy = req.user?.username;
    if (!createdBy) throw new UnauthorizedException('Authentication required');

    return await this.inviteService.createInvite(
      body.roomName,
      createdBy,
      body.duration,
      body.maxUses,
      body.description
    );
  }

  @Post(':code/use')
  @UseGuards(JwtAuthGuard)
  async useInvite(
    @Param('code') code: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const username = req.user?.username;
    if (!username) throw new UnauthorizedException('Authentication required');
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
  @UseGuards(JwtAuthGuard)
  async deactivateInvite(
    @Param('code') code: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const username = req.user?.username;
    if (!username) throw new UnauthorizedException('Authentication required');
    return await this.inviteService.deactivateInvite(code, username);
  }

  @Delete(':code')
  @UseGuards(JwtAuthGuard)
  async deleteInvite(
    @Param('code') code: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const username = req.user?.username;
    if (!username) throw new UnauthorizedException('Authentication required');
    return await this.inviteService.deleteInvite(code, username);
  }
}