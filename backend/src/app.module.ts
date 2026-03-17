
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { NotificationModule } from './notification/notification.module';
import { InviteModule } from './invite/invite.module';
import { AppealModule } from './appeal/appeal.module';
import { LinkPreviewModule } from './link-preview/link-preview.module';
import { RedisModule } from './redis/redis.module'; 

@Module({
  imports: [
    ChatModule,
    InviteModule,
    AuthModule,
    RedisModule,
    UserModule,
    NotificationModule,
    UploadModule,
    AppealModule,
    LinkPreviewModule,
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/db_user'
    ),
  ],
})
export class AppModule { }

