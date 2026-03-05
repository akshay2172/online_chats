// backend/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { Message, MessageSchema } from '../schemas/message.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Room, RoomSchema } from '../schemas/room.schema';
import { RoomBan, RoomBanSchema } from '../schemas/room-ban.schema';
import { ModerationLog, ModerationLogSchema } from '../schemas/moderation-log.schema';
import { DMConversation, DMConversationSchema } from '../schemas/dm-conversation.schema';
import { DMMessage, DMMessageSchema } from '../schemas/dm-message.schema';
import { FriendRequest, FriendRequestSchema } from '../schemas/friend-request.schema';
import { NotificationModule } from '../notification/notification.module';
import { UploadModule } from '../upload/upload.module';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomBan.name, schema: RoomBanSchema },
      { name: ModerationLog.name, schema: ModerationLogSchema },
      { name: DMConversation.name, schema: DMConversationSchema },
      { name: DMMessage.name, schema: DMMessageSchema },
      { name: FriendRequest.name, schema: FriendRequestSchema },
    ]),
    NotificationModule,
    UploadModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        // Allow images, documents, and archives
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/zip',
          'application/x-zip-compressed',
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Invalid file type'), false);
        }
      },
    }),
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule { }