import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';
import { Invite, InviteSchema } from '../schemas/invite.schema';
import { Room, RoomSchema } from '../schemas/room.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invite.name, schema: InviteSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  controllers: [InviteController],
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}