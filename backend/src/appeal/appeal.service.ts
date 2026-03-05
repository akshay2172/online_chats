// backend/src/appeal/appeal.service.ts
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appeal, AppealDocument } from '../schemas/appeal.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { ModerationLog, ModerationLogDocument } from '../schemas/moderation-log.schema';

@Injectable()
export class AppealService {
    constructor(
        @InjectModel(Appeal.name) private appealModel: Model<AppealDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(ModerationLog.name) private modLogModel: Model<ModerationLogDocument>,
    ) { }

    // ---------------------------------------------------------------
    // SUBMIT APPEAL (banned user only)
    // ---------------------------------------------------------------
    async submitAppeal(username: string, reason: string): Promise<AppealDocument> {
        // 1. Confirm user is actually globally banned
        const user = await this.userModel.findOne({ username });
        if (!user) throw new NotFoundException('User not found.');
        if (!user.isPlatformBanned) {
            throw new BadRequestException('You are not currently banned and do not need to submit an appeal.');
        }

        // 2. Prevent duplicate pending appeals
        const existing = await this.appealModel.findOne({ username, status: 'pending' });
        if (existing) {
            throw new BadRequestException('You already have a pending appeal. Please wait for it to be reviewed.');
        }

        // 3. Find who issued the ban (most recent 'ban' or 'platformBan' log entry)
        const banLog = await this.modLogModel
            .findOne({ targetUser: username, action: { $in: ['platformBan', 'ban'] } })
            .sort({ createdAt: -1 });

        return await this.appealModel.create({
            username,
            reason: reason.trim().slice(0, 2000), // cap at 2000 chars
            bannedBy: banLog?.moderator ?? 'unknown',
            status: 'pending',
        });
    }

    // ---------------------------------------------------------------
    // GET ALL APPEALS (Admin only)
    // ---------------------------------------------------------------
    async getAppeals(
        requesterUsername: string,
        statusFilter?: string,
    ): Promise<AppealDocument[]> {
        await this.requireAdmin(requesterUsername);

        const query: any = {};
        if (statusFilter) query.status = statusFilter;

        return await this.appealModel
            .find(query)
            .sort({ createdAt: -1 })
            .exec();
    }

    // ---------------------------------------------------------------
    // GET SINGLE APPEAL (Admin only)
    // ---------------------------------------------------------------
    async getAppeal(appealId: string, requesterUsername: string): Promise<AppealDocument> {
        await this.requireAdmin(requesterUsername);
        const appeal = await this.appealModel.findById(appealId);
        if (!appeal) throw new NotFoundException('Appeal not found.');
        return appeal;
    }

    // ---------------------------------------------------------------
    // REVIEW APPEAL (Admin only, cannot review own ban action)
    // ---------------------------------------------------------------
    async reviewAppeal(
        appealId: string,
        adminUsername: string,
        decision: 'approved' | 'rejected',
        adminNote?: string,
    ): Promise<AppealDocument> {
        // 1. Confirm reviewer is admin
        await this.requireAdmin(adminUsername);

        // 2. Load appeal
        const appeal = await this.appealModel.findById(appealId);
        if (!appeal) throw new NotFoundException('Appeal not found.');
        if (appeal.status !== 'pending') {
            throw new BadRequestException('This appeal has already been reviewed.');
        }

        // 3. Prevent reviewing own moderation action
        if (appeal.bannedBy === adminUsername) {
            throw new ForbiddenException(
                'You cannot review an appeal for a ban that you issued. Another admin must handle this.',
            );
        }

        // 4. Apply decision
        appeal.status = decision;
        appeal.reviewedBy = adminUsername;
        appeal.reviewedAt = new Date();
        appeal.adminNote = adminNote?.trim() ?? '';
        await appeal.save();

        // 5. If approved → unban the user
        if (decision === 'approved') {
            await this.userModel.findOneAndUpdate(
                { username: appeal.username },
                { isPlatformBanned: false },
            );
        }

        return appeal;
    }

    // ---------------------------------------------------------------
    // CHECK OWN APPEAL STATUS (the banned user themselves)
    // ---------------------------------------------------------------
    async getMyAppeal(username: string): Promise<AppealDocument | null> {
        return await this.appealModel
            .findOne({ username })
            .sort({ createdAt: -1 })
            .exec();
    }

    // ---------------------------------------------------------------
    // HELPER: enforce Admin role
    // ---------------------------------------------------------------
    private async requireAdmin(username: string): Promise<void> {
        // Owner is always allowed
        const isOwner = !!process.env.OWNER_ID && username === process.env.OWNER_ID;
        if (isOwner) return;

        const user = await this.userModel.findOne({ username });
        if (!user || user.globalRole !== 'admin') {
            throw new ForbiddenException('Only admins can access appeal management.');
        }
    }
}
