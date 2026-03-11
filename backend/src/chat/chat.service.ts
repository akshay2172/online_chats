// backend/chat/chat.service.ts - ENHANCED WITH MODERATION, ROOM BANS & DM
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Room, RoomDocument } from '../schemas/room.schema';
import { RoomBan, RoomBanDocument } from '../schemas/room-ban.schema';
import { ModerationLog, ModerationLogDocument } from '../schemas/moderation-log.schema';
import { DMConversation, DMConversationDocument } from '../schemas/dm-conversation.schema';
import { DMMessage, DMMessageDocument } from '../schemas/dm-message.schema';
import { FriendRequest, FriendRequestDocument } from '../schemas/friend-request.schema';

export interface RoomUser {
  name: string;
  displayName?: string;
  gender: 'male' | 'female' | 'other';
  country: string;
  socketId: string;
  isActive: boolean;
  avatar?: string;
  status?: string;
  role?: 'owner' | 'moderator' | 'member';
}

@Injectable()
export class ChatService {
  private activeUsers: Record<string, RoomUser[]> = {};
  private bannedUsers: Map<string, Set<string>> = new Map(); // room -> set of banned usernames

  // Map username -> socketId for DM delivery
  private userSocketMap: Map<string, string[]> = new Map();

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomBan.name) private roomBanModel: Model<RoomBanDocument>,
    @InjectModel(ModerationLog.name) private moderationLogModel: Model<ModerationLogDocument>,
    @InjectModel(DMConversation.name) private dmConversationModel: Model<DMConversationDocument>,
    @InjectModel(DMMessage.name) private dmMessageModel: Model<DMMessageDocument>,
    @InjectModel(FriendRequest.name) private friendRequestModel: Model<FriendRequestDocument>,
  ) {
    // Auto-delete inactive rooms every 24 hours on startup
    setInterval(() => this.autoDeleteInactiveRooms(), 24 * 60 * 60 * 1000);
  }

  // User Management
  addUserToRoom(room: string, user: RoomUser) {
    if (!this.activeUsers[room]) {
      this.activeUsers[room] = [];
    }

    // ✅ FIX: Check by socketId only (not username)
    // This allows multiple users with the same username
    const existingIndex = this.activeUsers[room].findIndex(u => u.socketId === user.socketId);

    if (existingIndex === -1) {
      // New user - add to room
      this.activeUsers[room].push(user);
      console.log(`✅ User ${user.name} (${user.socketId}) added to ${room} - chat.service.ts:44`);
    } else {
      // Existing user - update their data
      this.activeUsers[room][existingIndex] = user;
      console.log(`✅ User ${user.name} (${user.socketId}) updated in ${room} - chat.service.ts:48`);
    }
  }

  getUsersInRoom(room: string): RoomUser[] {
    return this.activeUsers[room] || [];
  }

  // ✅ FIX: Returns a deduplicated list of users by username
  getUniqueUsersInRoom(room: string): RoomUser[] {
    const allUsers = this.getUsersInRoom(room);
    const uniqueMap = new Map<string, RoomUser>();
    for (const user of allUsers) {
      if (!uniqueMap.has(user.name)) {
        uniqueMap.set(user.name, user);
      }
    }
    return Array.from(uniqueMap.values());
  }


  // --- 🛡️ GLOBAL MODERATION & USER CHECKS ---

  /** Synchronous env-var check — no DB call. The Owner can never be impersonated
   *  because this resolves purely from the server-side environment. */
  isOwner(username: string): boolean {
    return !!process.env.OWNER_ID && username === process.env.OWNER_ID;
  }

  async getUserWithRole(username: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({ username }).exec();
  }

  async isGlobalModOrAdmin(username: string): Promise<boolean> {
    const user = await this.userModel.findOne({ username });
    return user?.globalRole === 'admin' || user?.globalRole === 'global_mod';
  }

  async isPlatformBanned(username: string): Promise<boolean> {
    // Owner is NEVER banned — env var overrides any DB flag
    if (this.isOwner(username)) return false;
    const user = await this.userModel.findOne({ username });
    return user?.isPlatformBanned || false;
  }

  async banUserPlatform(username: string, isBanned: boolean): Promise<UserDocument> {
    return await this.userModel.findOneAndUpdate(
      { username },
      { isPlatformBanned: isBanned },
      { new: true }
    );
  }

  // --- 🏠 ROOM CREATION LIMITS & ELIGIBILITY ---

  /** Returns whether the user has an active warning logged in the last 30 days. */
  async hasActiveWarnings(username: string): Promise<boolean> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await this.moderationLogModel.countDocuments({
      targetUser: username,
      action: 'warn',
      createdAt: { $gte: since },
    });
    return count > 0;
  }

  /** Returns the room creation limit for the given user based on their current role. */
  private getRoleLimit(user: UserDocument): number {
    if (user.globalRole === 'admin') return 10;
    if (user.globalRole === 'global_mod') return 10;
    return user.roomCreationLimit ?? 3;
  }

  async canUserCreateRoomWithReason(
    username: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Owner — no restrictions at all
    if (this.isOwner(username)) return { allowed: true };

    const user = await this.userModel.findOne({ username });
    if (!user) return { allowed: false, reason: 'User not found.' };

    const roomsCreated = await this.roomModel.countDocuments({ createdBy: username, isActive: true });
    const roleLimit = this.getRoleLimit(user);

    // --- Quota check (applies to all non-owner roles) ---
    // If the user has MORE rooms than their current role allows (demotion scenario),
    // block creation but keep existing rooms intact.
    if (roomsCreated >= roleLimit) {
      return {
        allowed: false,
        reason: `You've exceeded your current plan limit (${roomsCreated}/${roleLimit} rooms). Existing rooms are kept, but you cannot create new ones until you're within the limit.`,
      };
    }

    // Admins & Global Mods — quota only, no eligibility checks below
    if (user.globalRole === 'admin' || user.globalRole === 'global_mod') {
      return { allowed: true };
    }

    // --- Eligibility checks for regular registered users ---

    // 1. Email must be verified
    if (!user.isVerified) {
      return { allowed: false, reason: 'Your email must be verified before you can create rooms. Please check your inbox.' };
    }

    // 2. Account must be at least 3 days old
    const createdAt = (user as any).createdAt as Date;
    const accountAgeDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < 3) {
      const daysLeft = Math.ceil(3 - accountAgeDays);
      return { allowed: false, reason: `Your account must be at least 3 days old to create rooms. ${daysLeft} day(s) remaining.` };
    }

    // 3. Must have sent at least 10 messages in public rooms
    const MIN_MESSAGES = 10;
    const publicRooms = await this.roomModel.find({ type: 'public', isActive: true }).select('name');
    const publicRoomNames = publicRooms.map(r => r.name);
    const publicMessageCount = await this.messageModel.countDocuments({
      sender: username,
      room: { $in: publicRoomNames },
      isDeleted: false,
    });
    if (publicMessageCount < MIN_MESSAGES) {
      return { allowed: false, reason: `You need to send at least ${MIN_MESSAGES} messages in public rooms before creating your own. (${publicMessageCount}/${MIN_MESSAGES} sent)` };
    }

    // 4. No active platform ban or recent warning
    if (user.isPlatformBanned) {
      return { allowed: false, reason: 'Your account is currently banned and cannot create rooms.' };
    }
    const hasWarning = await this.hasActiveWarnings(username);
    if (hasWarning) {
      return { allowed: false, reason: 'You have an active warning on your account. Room creation is temporarily restricted.' };
    }

    return { allowed: true };
  }

  /** Legacy boolean wrapper — kept so existing callers don't break. */
  async canUserCreateRoom(username: string): Promise<boolean> {
    const { allowed } = await this.canUserCreateRoomWithReason(username);
    return allowed;
  }

  // Only return public rooms in the main feed (private rooms are invite-link only)
  async getAllPublicRooms(): Promise<RoomDocument[]> {
    return await this.roomModel.find({ isActive: true, type: 'public' }).exec();
  }


  removeUserFromRoom(room: string, usernameOrSocketId: string) {
    if (!this.activeUsers[room]) return;

    // ✅ FIX: Remove by socketId to handle duplicate usernames
    // Also support removal by username for backward compatibility
    const initialCount = this.activeUsers[room].length;

    this.activeUsers[room] = this.activeUsers[room].filter(
      u => u.socketId !== usernameOrSocketId && u.name !== usernameOrSocketId
    );

    const removed = initialCount - this.activeUsers[room].length;
    if (removed > 0) {
      console.log(`✅ Removed ${removed} user(s) from ${room} - chat.service.ts:113`);
    }
  }

  getRoomsBySocket(socketId: string) {
    const results: { room: string, user: any }[] = [];
    for (const room in this.activeUsers) {
      const user = this.activeUsers[room].find(u => u.socketId === socketId);
      if (user) results.push({ room, user });
    }
    return results;
  }

  getUserSocketId(room: string, username: string): string | undefined {
    const user = this.activeUsers[room]?.find(u => u.name === username);
    return user?.socketId;
  }

  // Returns active users with roles read dynamically from the DB
  async getUsersInRoomWithRoles(roomName: string): Promise<any[]> {
    const room = await this.roomModel.findOne({ name: roomName });
    const active = this.getUniqueUsersInRoom(roomName);

    const usersWithRoles = await Promise.all(
      active.map(async u => {
        let role = 'member';
        if (room) {
          if (room.createdBy === u.name) role = 'owner';
          else if (room.moderators?.includes(u.name)) role = 'moderator';
        }

        // Fetch globalRole and displayName from DB
        const dbUser = await this.userModel.findOne({ username: u.name }).select('globalRole displayName').lean();
        const globalRole = dbUser?.globalRole || 'user';
        const displayName = dbUser?.displayName || u.displayName || u.name;

        return { ...u, role, globalRole, displayName };
      })
    );

    return usersWithRoles;
  }

  // Ban Management (uses RoomBan schema for audit trail & temp bans)
  async banUserFromRoom(
    roomName: string,
    username: string,
    bannedBy: string,
    reason?: string,
    duration?: number, // minutes, 0 or undefined = permanent
  ): Promise<void> {
    // Deactivate any existing bans first
    await this.roomBanModel.updateMany(
      { roomName, username, isActive: true },
      { isActive: false },
    );

    const banData: any = {
      roomName,
      username,
      bannedBy,
      reason,
      banType: duration && duration > 0 ? 'temporary' : 'permanent',
      isActive: true,
    };
    if (duration && duration > 0) {
      banData.expiresAt = new Date(Date.now() + duration * 60 * 1000);
    }
    await this.roomBanModel.create(banData);

    // Also keep legacy bannedUsers array in sync
    const room = await this.roomModel.findOne({ name: roomName });
    if (room) {
      if (!room.bannedUsers) room.bannedUsers = [];
      if (!room.bannedUsers.includes(username)) {
        room.bannedUsers.push(username);
        await room.save();
      }
    }

    // In-memory cache
    if (!this.bannedUsers.has(roomName)) {
      this.bannedUsers.set(roomName, new Set());
    }
    this.bannedUsers.get(roomName)?.add(username);
  }

  async isUserBanned(roomName: string, username: string): Promise<boolean> {
    // Check RoomBan collection (supports expiry)
    const activeBan = await this.roomBanModel.findOne({
      roomName,
      username,
      isActive: true,
      $or: [
        { banType: 'permanent' },
        { banType: 'temporary', expiresAt: { $gt: new Date() } },
      ],
    });

    if (activeBan) return true;

    // Auto-expire stale temp bans
    await this.roomBanModel.updateMany(
      { roomName, username, banType: 'temporary', expiresAt: { $lte: new Date() }, isActive: true },
      { isActive: false },
    );

    // Fallback: check legacy bannedUsers array
    const room = await this.roomModel.findOne({ name: roomName });
    return room?.bannedUsers?.includes(username) || false;
  }

  async unbanUserFromRoom(roomName: string, username: string): Promise<void> {
    // Deactivate all active bans
    await this.roomBanModel.updateMany(
      { roomName, username, isActive: true },
      { isActive: false },
    );

    // Remove from legacy array
    const room = await this.roomModel.findOne({ name: roomName });
    if (room && room.bannedUsers) {
      room.bannedUsers = room.bannedUsers.filter(u => u !== username);
      await room.save();
    }

    this.bannedUsers.get(roomName)?.delete(username);
  }

  async getRoomBans(roomName: string): Promise<RoomBanDocument[]> {
    return await this.roomBanModel.find({
      roomName,
      isActive: true,
      $or: [
        { banType: 'permanent' },
        { banType: 'temporary', expiresAt: { $gt: new Date() } },
      ],
    }).sort({ createdAt: -1 }).exec();
  }

  async getUserRoomCount(username: string): Promise<{ created: number; limit: number }> {
    if (this.isOwner(username)) return { created: 0, limit: Infinity };

    const user = await this.userModel.findOne({ username });
    if (!user) return { created: 0, limit: 3 };

    const created = await this.roomModel.countDocuments({ createdBy: username, isActive: true });
    return { created, limit: this.getRoleLimit(user) };
  }

  // Message CRUD with Database
  async createMessage(messageData: any): Promise<MessageDocument> {
    const message = new this.messageModel(messageData);
    return await message.save();
  }

  async getMessages(room: string, limit: number = 100, skip: number = 0): Promise<MessageDocument[]> {
    return await this.messageModel
      .find({ room, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async getMessageById(messageId: string): Promise<MessageDocument | null> {
    return await this.messageModel.findById(messageId).exec();
  }

  async updateMessage(messageId: string, updates: any): Promise<MessageDocument | null> {
    return await this.messageModel
      .findByIdAndUpdate(messageId, updates, { new: true })
      .exec();
  }

  async deleteMessage(messageId: string): Promise<MessageDocument | null> {
    return await this.messageModel
      .findByIdAndUpdate(messageId, { isDeleted: true }, { new: true })
      .exec();
  }

  // Edit Message
  async editMessage(messageId: string, newMessage: string): Promise<MessageDocument | null> {
    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          message: newMessage,
          isEdited: true,
          editedAt: new Date(),
        },
        { new: true }
      )
      .exec();
  }

  // Reactions
  async addReaction(messageId: string, emoji: string, username: string): Promise<MessageDocument | null> {
    const message = await this.messageModel.findById(messageId);
    if (!message) return null;

    const reactions = message.reactions || [];
    const existingReaction = reactions.find(r => r.emoji === emoji);

    if (existingReaction) {
      if (!existingReaction.users.includes(username)) {
        existingReaction.users.push(username);
      }
    } else {
      reactions.push({ emoji, users: [username] });
    }

    return await this.messageModel
      .findByIdAndUpdate(messageId, { reactions }, { new: true })
      .exec();
  }

  async removeReaction(messageId: string, emoji: string, username: string): Promise<MessageDocument | null> {
    const message = await this.messageModel.findById(messageId);
    if (!message) return null;

    let reactions = message.reactions || [];
    reactions = reactions
      .map(r => {
        if (r.emoji === emoji) {
          return { emoji: r.emoji, users: r.users.filter(u => u !== username) };
        }
        return r;
      })
      .filter(r => r.users.length > 0);

    return await this.messageModel
      .findByIdAndUpdate(messageId, { reactions }, { new: true })
      .exec();
  }

  // Read Receipts
  async markAsRead(messageId: string, username: string): Promise<MessageDocument | null> {
    const message = await this.messageModel.findById(messageId);
    if (!message) return null;

    const readBy = message.readBy || [];
    if (!readBy.includes(username)) {
      readBy.push(username);
    }

    return await this.messageModel
      .findByIdAndUpdate(messageId, { readBy }, { new: true })
      .exec();
  }

  async markRoomAsRead(room: string, username: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        room,
        sender: { $ne: username },
        readBy: { $ne: username },
      },
      {
        $addToSet: { readBy: username }
      }
    );
  }

  // Search Messages
  async searchMessages(
    room: string,
    query: string,
    limit: number = 50,
    filters?: {
      from?: string;
      has?: string;
      before?: string;
      after?: string;
      mentions?: string;
    }
  ): Promise<MessageDocument[]> {
    const conditions: any[] = [{ room }, { isDeleted: false }];

    // Text query (optional - can search with only filters)  
    // Text query (optional - can search with only filters)  
    let modifiedQuery = query;
    if (query.toLowerCase().includes('has:link')) {
      if (!filters) filters = {};
      filters.has = 'link';
      modifiedQuery = query.replace(/has:link/gi, '').trim();
    }

    if (modifiedQuery) {
      const escapedQuery = modifiedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({
        $or: [
          { message: { $regex: escapedQuery, $options: 'i' } },
          { sender: { $regex: escapedQuery, $options: 'i' } },
        ],
      });
    }


    // Filters  
    if (filters) {
      if (filters.from) {
        const escapedFrom = filters.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ sender: { $regex: `^${escapedFrom}$`, $options: 'i' } });
      }
      if (filters.has) {
        switch (filters.has) {
          case 'image':
            conditions.push({ messageType: 'image' });
            break;
          case 'file':
            conditions.push({ messageType: 'file' });
            break;
          case 'gif':
            conditions.push({ messageType: 'gif' });
            break;
          case 'voice':
            conditions.push({ messageType: 'voice' });
            break;
          case 'link':
            conditions.push({ message: { $regex: 'https?://', $options: 'i' } });
            break;
        }
      }
      if (filters.before) {
        conditions.push({ createdAt: { $lt: new Date(filters.before) } });
      }
      if (filters.after) {
        conditions.push({ createdAt: { $gt: new Date(filters.after) } });
      }
      if (filters.mentions) {
        const escapedMention = filters.mentions.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ mentions: { $regex: `^${escapedMention}$`, $options: 'i' } });
      }
    }

    return await this.messageModel
      .find({ $and: conditions })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Pin/Unpin Messages
  async pinMessage(messageId: string): Promise<MessageDocument | null> {
    return await this.messageModel
      .findByIdAndUpdate(messageId, { isPinned: true }, { new: true })
      .exec();
  }

  async unpinMessage(messageId: string): Promise<MessageDocument | null> {
    return await this.messageModel
      .findByIdAndUpdate(messageId, { isPinned: false }, { new: true })
      .exec();
  }

  async getPinnedMessages(room: string): Promise<MessageDocument[]> {
    return await this.messageModel
      .find({ room, isPinned: true, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  // User Profile Management
  async createUser(userData: any): Promise<UserDocument> {
    const user = new this.userModel(userData);
    return await user.save();
  }

  async getUserByUsername(username: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({ username }).exec();
  }

  async updateUserProfile(username: string, updates: any): Promise<UserDocument | null> {
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await this.userModel
      .findOneAndUpdate({ username: new RegExp('^' + escapedUsername + '$', 'i') }, updates, { new: true })
      .exec();
  }

  async updateUserStatus(username: string, status: string): Promise<UserDocument | null> {
    return await this.userModel
      .findOneAndUpdate(
        { username },
        { status, lastSeen: new Date() },
        { new: true }
      )
      .exec();
  }

  // Room Management
  async createRoom(roomData: any): Promise<RoomDocument> {
    const room = new this.roomModel(roomData);
    return await room.save();
  }

  async getRoomByName(name: string): Promise<RoomDocument | null> {
    return await this.roomModel.findOne({ name }).exec();
  }

  async getRoomById(id: string): Promise<RoomDocument | null> {
    return await this.roomModel.findById(id).exec();
  }

  async getAllRooms(): Promise<RoomDocument[]> {
    return await this.roomModel.find({ isActive: true }).exec();
  }

  async getRoomsByUser(username: string): Promise<RoomDocument[]> {
    return await this.roomModel
      .find({ members: username, isActive: true })
      .exec();
  }

  async addMemberToRoom(roomName: string, username: string): Promise<RoomDocument | null> {
    return await this.roomModel
      .findOneAndUpdate(
        { name: roomName },
        { $addToSet: { members: username } },
        { new: true }
      )
      .exec();
  }

  async removeMemberFromRoom(roomName: string, username: string): Promise<RoomDocument | null> {
    return await this.roomModel
      .findOneAndUpdate(
        { name: roomName },
        { $pull: { members: username } },
        { new: true }
      )
      .exec();
  }

  async deleteRoom(roomId: string): Promise<RoomDocument | null> {
    return await this.roomModel
      .findByIdAndUpdate(roomId, { isActive: false }, { new: true })
      .exec();
  }

  async promoteUser(roomName: string, username: string, role: 'moderator' | 'member'): Promise<RoomDocument | null> {
    if (role === 'member') {
      return await this.roomModel
        .findOneAndUpdate(
          { name: roomName },
          { $pull: { moderators: username } },
          { new: true }
        )
        .exec();
    }

    // Only 'moderator' left as a promotable room role
    return await this.roomModel
      .findOneAndUpdate(
        { name: roomName },
        { $addToSet: { moderators: username } },
        { new: true }
      )
      .exec();
  }


  // File Management (metadata only, actual files stored separately)
  async saveFileMessage(room: string, sender: string, fileData: any): Promise<MessageDocument> {
    let messageType = 'file';
    if (fileData.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (fileData.mimetype.startsWith('audio/')) {
      messageType = 'voice';    // ✅ Add this condition
    }

    const messageData = {
      room,
      sender,
      message: fileData.originalName,
      messageType,
      fileData,
      readBy: [sender],        // ✅ Important: set readBy to avoid unread count issues
    };

    return await this.createMessage(messageData);
  }

  // Analytics
  async getMessageCount(room: string): Promise<number> {
    return await this.messageModel.countDocuments({ room, isDeleted: false });
  }

  async getUserMessageCount(room: string, username: string): Promise<number> {
    return await this.messageModel.countDocuments({
      room,
      sender: username,
      isDeleted: false,
    });
  }

  async getUnreadCount(room: string, username: string): Promise<number> {
    return await this.messageModel.countDocuments({
      room,
      sender: { $ne: username },
      readBy: { $ne: username },
      isDeleted: false,
    });
  }

  // Block user (DM level)
  async blockUser(blockerUsername: string, blockedUsername: string): Promise<UserDocument | null> {
    return await this.userModel
      .findOneAndUpdate(
        { username: blockerUsername },
        { $addToSet: { blockedUsers: blockedUsername } },
        { new: true }
      )
      .exec();
  }

  async unblockUser(blockerUsername: string, blockedUsername: string): Promise<UserDocument | null> {
    return await this.userModel
      .findOneAndUpdate(
        { username: blockerUsername },
        { $pull: { blockedUsers: blockedUsername } },
        { new: true }
      )
      .exec();
  }

  async isUserBlocked(blockerUsername: string, blockedUsername: string): Promise<boolean> {
    const user = await this.userModel.findOne({ username: blockerUsername });
    return user?.blockedUsers?.includes(blockedUsername) || false;
  }

  // Infinite scroll - load older messages
  async loadOlderMessages(room: string, beforeMessageId: string, limit: number = 50): Promise<MessageDocument[]> {
    const beforeMessage = await this.messageModel.findById(beforeMessageId);
    if (!beforeMessage) return [];

    return await this.messageModel
      .find({
        room,
        isDeleted: false,
        createdAt: { $lt: beforeMessage.createdAt },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // --- ⚖️ STRICT HIERARCHY WEIGHT ENGINE ---
  async getUserHierarchyWeight(username: string, roomName?: string): Promise<number> {
    // 1. Supreme Owner (Environment Variable)
    if (username === process.env.OWNER_ID) return 100;

    const user = await this.userModel.findOne({ username });

    // 2. Platform Admin
    if (user?.globalRole === 'admin') return 80;

    // 3. Global Moderator
    if (user?.globalRole === 'global_mod') return 60;

    // Room specific roles
    if (roomName) {
      const roomDoc = await this.roomModel.findOne({ name: roomName });
      if (roomDoc) {
        // 4. Room Owner
        if (roomDoc.createdBy === username) return 40;
        // 5. Room Moderator
        if (roomDoc.moderators?.includes(username)) return 20;
      }
    }

    // 7. Regular User / Guest
    return 0;
  }

  // --- 🔇 MUTE MANAGEMENT ---
  async isUserMuted(roomName: string, username: string): Promise<boolean> {
    const room = await this.roomModel.findOne({ name: roomName });
    return room?.mutedUsers?.includes(username) || false;
  }

  async muteUser(roomName: string, username: string): Promise<void> {
    await this.roomModel.updateOne(
      { name: roomName },
      { $addToSet: { mutedUsers: username } }
    );
  }

  async unmuteUser(roomName: string, username: string): Promise<void> {
    await this.roomModel.updateOne(
      { name: roomName },
      { $pull: { mutedUsers: username } }
    );
  }

  // --- 📜 MODERATION LOGGING ---
  async logModerationAction(action: string, moderator: string, targetUser: string, roomName?: string, reason?: string) {
    try {
      await this.moderationLogModel.create({ action, moderator, targetUser, roomName, reason });
    } catch (error) {
      console.error('Failed to log moderation action:', error);
    }
  }

  // --- 🗑️ AUTO-DELETE INACTIVE ROOMS ---
  // Runs every 24 h. Marks a room inactive if it has had no messages in 7 days
  // and currently has zero active members.
  async autoDeleteInactiveRooms(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Find rooms that have been active but haven't received a message since the cutoff
      const staleRooms = await this.roomModel.find({ isActive: true });

      for (const room of staleRooms) {
        // Skip rooms that have currently active in-memory users
        const activeInRoom = this.activeUsers[room.name];
        if (activeInRoom && activeInRoom.length > 0) continue;

        // Check last message timestamp
        const lastMessage = await this.messageModel
          .findOne({ room: room.name, isDeleted: false })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .exec();

        const lastActivity = lastMessage ? (lastMessage as any).createdAt : (room as any).createdAt;
        if (lastActivity < cutoff) {
          await this.roomModel.findByIdAndUpdate(room._id, { isActive: false });
          console.log(`[AutoDelete] Marked room '${room.name}' inactive after 7 days of inactivity.`);
        }
      }
    } catch (error) {
      console.error('[AutoDelete] Error during inactive room cleanup:', error);
    }
  }

  // ==================== DM SYSTEM ====================

  registerUserSocket(username: string, socketId: string) {
    const existing = this.userSocketMap.get(username) || [];
    if (!existing.includes(socketId)) {
      existing.push(socketId);
    }
    this.userSocketMap.set(username, existing);
  }

  unregisterUserSocket(username: string, socketId: string) {
    const existing = this.userSocketMap.get(username) || [];
    const updated = existing.filter(s => s !== socketId);
    if (updated.length === 0) {
      this.userSocketMap.delete(username);
    } else {
      this.userSocketMap.set(username, updated);
    }
  }

  getUserSocketIds(username: string): string[] {
    return this.userSocketMap.get(username) || [];
  }

  async getOrCreateDMConversation(user1: string, user2: string): Promise<DMConversationDocument> {
    // Sort participants for consistent lookup
    const participants = [user1, user2].sort();

    let conversation = await this.dmConversationModel.findOne({
      participants: { $all: participants, $size: 2 },
    });

    if (!conversation) {
      try {
        conversation = new this.dmConversationModel({
          participants,
          lastMessage: '',
          lastMessageAt: new Date(),
          deletedBy: [],
        });
        // Initialize unreadCount as a Map
        conversation.unreadCount = new Map<string, number>();
        conversation.unreadCount.set(user1, 0);
        conversation.unreadCount.set(user2, 0);
        await conversation.save();
      } catch (err: any) {
        // Handle race condition: if another request created it between findOne and create
        if (err.code === 11000) {
          conversation = await this.dmConversationModel.findOne({
            participants: { $all: participants, $size: 2 },
          });
          if (!conversation) throw err;
        } else {
          throw err;
        }
      }
    }

    // If user had soft-deleted, un-delete for them
    if (conversation.deletedBy?.includes(user1)) {
      await this.dmConversationModel.updateOne(
        { _id: conversation._id },
        { $pull: { deletedBy: user1 } },
      );
      conversation.deletedBy = conversation.deletedBy.filter(u => u !== user1);
    }

    return conversation;
  }

  async sendDMMessage(
    conversationId: string,
    sender: string,
    receiver: string,
    message: string,
    messageType: string = 'text',
    fileData?: any,
    replyTo?: string,
    replyToMessage?: any,
  ): Promise<DMMessageDocument> {
    const dmMessage = await this.dmMessageModel.create({
      conversationId,
      sender,
      receiver,
      message,
      messageType,
      fileData,
      replyTo,
      replyToMessage,
    });

    // Update conversation metadata
    const conversation = await this.dmConversationModel.findById(conversationId);
    if (conversation) {
      conversation.lastMessage = message.substring(0, 100);
      conversation.lastMessageSender = sender;
      conversation.lastMessageAt = new Date();

      // Ensure unreadCount is a Map
      if (!conversation.unreadCount || typeof conversation.unreadCount.get !== 'function') {
        const oldData = conversation.unreadCount || {};
        conversation.unreadCount = new Map<string, number>();
        for (const [k, v] of Object.entries(oldData)) {
          if (typeof v === 'number') conversation.unreadCount.set(k, v);
        }
      }

      // Increment unread for receiver
      const currentUnread = conversation.unreadCount.get(receiver) || 0;
      conversation.unreadCount.set(receiver, currentUnread + 1);

      // If receiver had soft-deleted, un-delete so they see the new message
      if (conversation.deletedBy?.includes(receiver)) {
        conversation.deletedBy = conversation.deletedBy.filter(u => u !== receiver);
        conversation.markModified('deletedBy');
      }

      await conversation.save();
    }

    return dmMessage;
  }

  async getDMConversations(username: string): Promise<any[]> {
    const conversations = await this.dmConversationModel
      .find({
        participants: username,
        deletedBy: { $ne: username },
      })
      .sort({ lastMessageAt: -1 })
      .lean()
      .exec();

    // Enrich with other user's profile data
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const otherUsername = conv.participants.find((p: string) => p !== username);
        const otherUser = await this.userModel
          .findOne({ username: otherUsername })
          .select('username avatar status bio displayName')
          .lean();

        return {
          ...conv,
          otherUser: otherUser || { username: otherUsername, avatar: null, status: 'offline' },
          unreadCount: conv.unreadCount instanceof Map
            ? (conv.unreadCount.get(username) || 0)
            : (conv.unreadCount?.[username] || 0),
        };
      }),
    );

    return enriched;
  }

  async getDMMessages(
    conversationId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<DMMessageDocument[]> {
    return await this.dmMessageModel
      .find({ conversationId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async markDMAsRead(conversationId: string, username: string): Promise<void> {
    // Mark individual messages as read
    await this.dmMessageModel.updateMany(
      { conversationId, receiver: username, readAt: null },
      { readAt: new Date() },
    );

    // Reset unread counter
    const conversation = await this.dmConversationModel.findById(conversationId);
    if (conversation) {
      if (!conversation.unreadCount || typeof conversation.unreadCount.set !== 'function') {
        const oldData = conversation.unreadCount || {};
        conversation.unreadCount = new Map<string, number>();
        for (const [k, v] of Object.entries(oldData)) {
          if (typeof v === 'number') conversation.unreadCount.set(k, v);
        }
      }
      conversation.unreadCount.set(username, 0);
      await conversation.save();
    }
  }

  async markDMMessageDelivered(messageId: string): Promise<void> {
    await this.dmMessageModel.findByIdAndUpdate(messageId, { deliveredAt: new Date() });
  }

  async markPendingDMsAsDelivered(username: string): Promise<DMMessageDocument[]> {
    const now = new Date();
    const messages = await this.dmMessageModel.find({
      receiver: username,
      deliveredAt: null,
      isDeleted: false,
    }).exec();

    if (messages.length > 0) {
      await this.dmMessageModel.updateMany(
        { receiver: username, deliveredAt: null, isDeleted: false },
        { deliveredAt: now },
      );
      // Return with deliveredAt set for notification
      return messages.map(m => { m.deliveredAt = now; return m; });
    }
    return [];
  }

  async deleteDMConversation(conversationId: string, username: string): Promise<void> {
    await this.dmConversationModel.findByIdAndUpdate(conversationId, {
      $addToSet: { deletedBy: username },
    });
  }

  async pinDMMessage(messageId: string): Promise<DMMessageDocument | null> {
    return await this.dmMessageModel.findByIdAndUpdate(messageId, { isPinned: true }, { new: true }).exec();
  }

  async unpinDMMessage(messageId: string): Promise<DMMessageDocument | null> {
    return await this.dmMessageModel.findByIdAndUpdate(messageId, { isPinned: false }, { new: true }).exec();
  }

  async reportDMMessage(messageId: string): Promise<DMMessageDocument | null> {
    return await this.dmMessageModel.findByIdAndUpdate(messageId, { isReported: true }, { new: true }).exec();
  }

  async getDMMessageById(messageId: string): Promise<DMMessageDocument | null> {
    return await this.dmMessageModel.findById(messageId).exec();
  }

  async getDMConversationById(conversationId: string): Promise<DMConversationDocument | null> {
    return await this.dmConversationModel.findById(conversationId).exec();
  }

  async addDMReaction(messageId: string, emoji: string, username: string): Promise<DMMessageDocument | null> {
    const msg = await this.dmMessageModel.findById(messageId);
    if (!msg) return null;

    if (!msg.reactions) {
      msg.reactions = [];
    }

    const reactIndex = msg.reactions.findIndex(r => r.emoji === emoji);
    if (reactIndex >= 0) {
      if (!msg.reactions[reactIndex].users.includes(username)) {
        msg.reactions[reactIndex].users.push(username);
      }
    } else {
      msg.reactions.push({ emoji, users: [username] });
    }

    // Must markModified because reactions might be a mixed type depending on schema
    msg.markModified('reactions');
    await msg.save();
    return msg;
  }

  async removeDMReaction(messageId: string, emoji: string, username: string): Promise<DMMessageDocument | null> {
    const msg = await this.dmMessageModel.findById(messageId);
    if (!msg || !msg.reactions) return null;

    const reactIndex = msg.reactions.findIndex(r => r.emoji === emoji);
    if (reactIndex >= 0) {
      msg.reactions[reactIndex].users = msg.reactions[reactIndex].users.filter(u => u !== username);
      if (msg.reactions[reactIndex].users.length === 0) {
        msg.reactions.splice(reactIndex, 1);
      }
      msg.markModified('reactions');
      await msg.save();
    }
    return msg;
  }

  async softDeleteDMMessage(messageId: string, username: string): Promise<boolean> {
    const msg = await this.dmMessageModel.findById(messageId);
    if (!msg || msg.sender !== username) return false;

    // Using soft delete to keep history if needed or just physical delete based on schema
    // Assuming physical delete for simplicity as requested 'deleteDMMessage' 
    // Or we can set isDeleted=true if schema supports it
    await this.dmMessageModel.findByIdAndDelete(messageId);
    return true;
  }

  async editDMMessage(messageId: string, newMessage: string, username: string): Promise<DMMessageDocument | null> {
    const msg = await this.dmMessageModel.findById(messageId);
    if (!msg || msg.sender !== username) return null;

    msg.message = newMessage;
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();
    return msg;
  }

  async getUserFullProfile(username: string): Promise<any> {
    const user = await this.userModel
      .findOne({ username })
      .select('username displayName email avatar coverPhoto bio age country gender status lastSeen globalRole createdAt blockedUsers')
      .lean();

    if (!user) return null;

    return {
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar,
      coverPhoto: (user as any).coverPhoto,
      bio: user.bio || '',
      age: (user as any).age,
      country: user.country,
      gender: user.gender,
      status: user.status || 'offline',
      lastSeen: user.lastSeen,
      globalRole: user.globalRole || 'user',
      createdAt: (user as any).createdAt,
    };
  }

  // ==================== FRIEND SYSTEM ====================

  async sendFriendRequest(from: string, to: string): Promise<FriendRequestDocument> {
    // Check if a request already exists in either direction
    const existing = await this.friendRequestModel.findOne({
      $or: [
        { from, to },
        { from: to, to: from },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('You are already friends.');
      }
      if (existing.status === 'pending' && existing.from === from) {
        throw new Error('Friend request already sent.');
      }
      if (existing.status === 'pending' && existing.from === to) {
        // The other user already sent us a request — auto-accept
        existing.status = 'accepted';
        await existing.save();
        return existing;
      }
      if (existing.status === 'rejected') {
        // Allow re-sending after rejection
        existing.status = 'pending';
        existing.from = from;
        existing.to = to;
        await existing.save();
        return existing;
      }
    }

    return await this.friendRequestModel.create({ from, to, status: 'pending' });
  }

  async respondToFriendRequest(requestId: string, username: string, action: 'accept' | 'reject'): Promise<FriendRequestDocument | null> {
    const request = await this.friendRequestModel.findById(requestId);
    if (!request || request.to !== username) return null;
    request.status = action === 'accept' ? 'accepted' : 'rejected';
    await request.save();
    return request;
  }

  async getFriendRequests(username: string): Promise<any[]> {
    const requests = await this.friendRequestModel
      .find({ to: username, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with sender profile
    return await Promise.all(
      requests.map(async (req) => {
        const user = await this.userModel
          .findOne({ username: req.from })
          .select('username avatar displayName status')
          .lean();
        return { ...req, fromUser: user || { username: req.from } };
      }),
    );
  }

  async getFriends(username: string): Promise<any[]> {
    const accepted = await this.friendRequestModel
      .find({
        $or: [{ from: username }, { to: username }],
        status: 'accepted',
      })
      .lean();

    const friendUsernames = accepted.map((r) =>
      r.from === username ? r.to : r.from,
    );

    // Enrich with profile data
    const friends = await Promise.all(
      friendUsernames.map(async (friendName) => {
        const user = await this.userModel
          .findOne({ username: friendName })
          .select('username avatar displayName status bio')
          .lean();
        return user || { username: friendName, avatar: null, status: 'offline' };
      }),
    );

    return friends;
  }

  async removeFriend(username: string, friendUsername: string): Promise<boolean> {
    const result = await this.friendRequestModel.deleteOne({
      $or: [
        { from: username, to: friendUsername, status: 'accepted' },
        { from: friendUsername, to: username, status: 'accepted' },
      ],
    });
    return result.deletedCount > 0;
  }

  async areFriends(user1: string, user2: string): Promise<boolean> {
    const friendship = await this.friendRequestModel.findOne({
      $or: [
        { from: user1, to: user2, status: 'accepted' },
        { from: user2, to: user1, status: 'accepted' },
      ],
    });
    return !!friendship;
  }
}