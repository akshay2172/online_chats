// backend/src/appeal/appeal.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appeal, AppealSchema } from '../schemas/appeal.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ModerationLog, ModerationLogSchema } from '../schemas/moderation-log.schema';
import { AppealService } from './appeal.service';
import { AppealController } from './appeal.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Appeal.name, schema: AppealSchema },
            { name: User.name, schema: UserSchema },
            { name: ModerationLog.name, schema: ModerationLogSchema },
        ]),
    ],
    providers: [AppealService],
    controllers: [AppealController],
    exports: [AppealService],
})
export class AppealModule { }
