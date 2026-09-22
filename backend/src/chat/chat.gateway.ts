// backend/chat/chat.gateway.enhanced.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayDisconnect,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { socketAuthMiddleware, socketRateLimitMiddleware, IPBanList, AuthenticatedSocket } from '../../middleware/socket-auth.middleware';
import { InputSanitizer, ContentModerator } from '../utils/input-sanitizer';
import { SecurityLogger } from '../utils/security-logger';
import { NotificationService } from '../notification/notification.service';
import { UploadService } from '../upload/upload.service';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { RedisService } from '../redis/redis.service';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import * as Dto from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024 * 1024 // 10MB for file uploads
})
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: (errors) => new WsException(errors) }))
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect, OnGatewayConnection {

  async afterInit(server: Server) {
    // Redis adapter for multi-server Socket.io
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    server.adapter(createAdapter(pubClient, subClient));

    // Apply authentication middleware
    server.use(socketAuthMiddleware);

    // Apply Rate Limiting middleware
    server.use(socketRateLimitMiddleware);

    // Apply IP ban middleware
    server.use((socket: Socket, next) => IPBanList.middleware(socket, next));

    SecurityLogger.logServerStart();
    console.log('✅ Secure WebSocket Gateway initialized with Redis adapter');
  }

  constructor(
    private chatService: ChatService,
    private notificationService: NotificationService,
    private uploadService: UploadService,
    private redisService: RedisService,
  ) { }

  @WebSocketServer()
  server: Server;

  private readonly RATE_LIMIT_WINDOW = 2000; // 1 minute
  private readonly RATE_LIMIT_MAX = 2; // 30 messages per minute

  async handleConnection(client: AuthenticatedSocket) {
    const username = client.data.user?.username || 'guest';
    const ip = client.handshake.address;
    if (client.data.user?.type === 'access' && username !== 'guest') {
      SecurityLogger.logAuthSuccess(username, ip, client.id);
      // Register socket for DM delivery
      this.chatService.registerUserSocket(username, client.id);
      console.log(`✅ User connected: ${username} (${client.id}) from ${ip} - chat.gateway.ts:54`);

      // Auto-send friends data
      try {
        const [friends, friendReqs] = await Promise.all([
          this.chatService.getFriends(username),
          this.chatService.getFriendRequests(username),
        ]);
        client.emit('friendsList', friends);
        client.emit('friendRequestsList', friendReqs);

        // Mark all undelivered DMs as delivered
        const undeliveredMessages = await this.chatService.markPendingDMsAsDelivered(username);
        for (const msg of undeliveredMessages) {
          const senderSockets = await this.chatService.getUserSocketIds(msg.sender);
          for (const socketId of senderSockets) {
            this.server.to(socketId).emit('dmMessageDelivered', {
              conversationId: msg.conversationId,
              messageId: msg._id.toString(),
              deliveredAt: msg.deliveredAt.toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Failed to load friends on connect:', err);
      }
    } else {
      console.log(`👤 Guest connected: (${client.id}) from ${ip} - chat.gateway.ts:56`);

      // ✅ FIX: Notify client if their token was invalid/expired
      if (client.data.authError) {
        client.emit('authDowngraded', {
          reason: client.data.authError,
          message: client.data.authError === 'Token expired'
            ? 'Your session has expired. Please log in again.'
            : 'Authentication failed. Please log in again.',
        });
      }
    }
  }

  // Rate limiting check
  private async checkRateLimit(username: string, ip: string): Promise<boolean> {
    const key = `ratelimit:${username}`;
    const now = Date.now();
    const redis = this.redisService.getClient();

    // Add current timestamp to sorted set
    await redis.zAdd(key, { score: now, value: now.toString() });
    // Remove entries outside the window
    await redis.zRemRangeByScore(key, 0, now - this.RATE_LIMIT_WINDOW);
    // Count entries in window
    const count = await redis.zCard(key);
    // Auto-expire the key after the window
    await redis.expire(key, Math.ceil(this.RATE_LIMIT_WINDOW / 1000) + 1);

    if (count > this.RATE_LIMIT_MAX) {
      SecurityLogger.logRateLimitExceeded(username, ip);
      return false; // Rate limit exceeded
    }
    return true;
  }

  // Idempotency deduplication check
  private async isDuplicateRequest(requestId?: string): Promise<boolean> {
    if (!requestId) return false;
    try {
      const redis = this.redisService.getClient();
      const key = `idempotency:${requestId}`;
      const set = await redis.set(key, '1', { EX: 10, NX: true });
      return set === null;
    } catch {
      return false;
    }
  }



  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: Dto.JoinRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      // --- SECURITY FIX: Guest Identity Segregation ---
      let username = client.data.user?.username;
      const isGuest = client.data.user?.type === 'guest';

      if (isGuest) {
        if (!data.username) {
          client.emit('error', { message: 'Username required for guests' });
          return;
        }
        // Prevent 'Guest_Guest_name' if they reconnect with the prefix already applied
        const cleanName = data.username.replace(/^Guest_/i, '');
        // Enforce prefix
        username = `Guest_${InputSanitizer.sanitizeUsername(cleanName)}`;
      }
      // ------------------------------------------------

      const ip = client.handshake.address;

      if (!data.room || data.room === 'undefined') {
        client.emit('error', { message: 'Invalid room ID' });
        return;
      }
      const room = InputSanitizer.sanitizeRoomName(data.room);
      const country = InputSanitizer.sanitizeText(data.country, 50);
      const gender = InputSanitizer.sanitizeGender(data.gender);

      const identity = client.data.user;
      let authenticatedUser: Awaited<ReturnType<ChatService['getUserById']>> = null;
      if (!isGuest) {
        if (!identity?.userId || !username) {
          client.emit('error', { status: 401, message: 'Authentication required' });
          return;
        }
        authenticatedUser = await this.chatService.getUserById(identity.userId);
        if (!authenticatedUser || authenticatedUser.username !== username) {
          client.emit('error', { status: 401, message: 'Authentication required' });
          return;
        }
        username = authenticatedUser.username;
      }

      // Resolve the room before checking membership or joining it.
      let roomDoc = await this.chatService.getRoomByName(room);

      // --- ðŸ›¡ï¸ 1. Check Platform-Level Ban (Registered Users Only) ---
      if (!isGuest) {
        const isPlatformBanned = await this.chatService.isPlatformBanned(username);
        if (isPlatformBanned) {
          client.emit('error', { message: 'Your account has been banned from the platform.' });
          return;
        }
      }

      // --- 🚫 2. Check Room-Level Ban ---
      const isBanned = await this.chatService.isUserBanned(room, username);
      if (isBanned) {
        client.emit('error', { message: 'You are banned from this room' });
        return;
      }

      if (!roomDoc && room !== 'general') {
        client.emit('error', { status: 404, message: 'Room not found' });
        return;
      }

      // --- 🏠 4. Auto-create room if it doesn't exist ---
      if (!roomDoc) {
        // Guests cannot create rooms
        if (isGuest) {
          client.emit('error', { message: 'Guests cannot create rooms. Please register to create a room.' });
          return;
        }

        // Registered users must meet eligibility requirements
        const { allowed, reason } = await this.chatService.canUserCreateRoomWithReason(username);
        if (!allowed) {
          client.emit('error', { message: reason ?? 'You are not eligible to create rooms.' });
          return;
        }

        // Create the room â€” user automatically becomes Room Owner via createdBy
        roomDoc = await this.chatService.findOrCreatePublicRoom(room, username);
      }

      // Re-check after the atomic upsert: a concurrent request may have
      // created a private room while this join request was in flight.
      if (roomDoc.type === 'private') {
        if (isGuest) {
          client.emit('error', { status: 403, message: 'Forbidden: private rooms require membership' });
          return;
        }
        const isMember = authenticatedUser &&
          roomDoc.members?.includes(authenticatedUser.username);
        if (!isMember) {
          client.emit('error', { status: 403, message: 'Forbidden: you are not a member of this private room' });
          return;
        }
      }

      // Auto-promote dev owner if applicable â€” now uses env-based OWNER_ID, not admins array
      // (legacy admin_owner promotion removed; use OWNER_ID in .env instead)

      // Join Socket.io room
      client.join(room);
      if (isGuest) {
        client.data.user!.username = username;
        client.data.user!.type = 'guest';
      }

      // Fetch displayName from DB for registered users
      let displayName = data.displayName || username;
      if (!isGuest) {
        const dbUser = await this.chatService.getUserWithRole(username);
        if (dbUser?.displayName) displayName = dbUser.displayName;
      }

      // Before adding user to room, prune stale entries for ANY user whose socket is no longer connected
      const existingUsers = await this.chatService.getUsersInRoom(room);
      for (const existing of existingUsers) {
          if (!this.server.sockets.sockets.has(existing.socketId)) {
              await this.chatService.removeStaleSocketEntry(room, existing.socketId);
          }
      }

      // Add to active users in memory
      await this.chatService.addUserToRoom(room, {
        name: username, displayName, gender, country, socketId: client.id, isActive: true, avatar: data.avatar, status: 'online',
      });

      // Update Database Status
      if (!isGuest) await this.chatService.updateUserStatus(username, 'online');

      // Load Messages & Data
      const messages = await this.chatService.getMessages(room, 100);
      client.emit('loadMessages', messages.reverse());

      const pinnedMessages = await this.chatService.getPinnedMessages(room);
      client.emit('loadPinnedMessages', pinnedMessages);

      if (!isGuest) {
        const unreadCount = await this.chatService.getUnreadCount(room, username);
        client.emit('unreadCount', unreadCount);
      }

      // Broadcast to Room
      this.server.to(room).emit('userEvent', { type: 'join', username, avatar: data.avatar });
      this.server.to(room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(room));

      // ✅ Tell the client exactly what their username resolved to!
      client.emit('roomJoined', { room, username });

      // Emit room info for the client
      if (roomDoc) {
        client.emit('roomInfo', {
          name: roomDoc.name,
          description: roomDoc.description,
          type: roomDoc.type,
        });
      } else if (room === 'general') {
        client.emit('roomInfo', {
          name: 'general',
          description: 'General public room',
          type: 'public',
        });
      }

    } catch (error) {
      SecurityLogger.logError(error, { event: 'joinRoom', user: client.data.user?.username });
      client.emit('error', { message: error.message });
    }
  }


  @SubscribeMessage('getRoomInfo')
  async handleGetRoomInfo(
    @MessageBody() data: Dto.RoomInfoDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!data.room || data.room === 'undefined') return;
      const roomName = InputSanitizer.sanitizeRoomName(data.room);
      const roomDoc = await this.chatService.getRoomByName(roomName);

      if (roomDoc) {
        client.emit('roomInfo', {
          name: roomDoc.name,
          description: roomDoc.description,
          type: roomDoc.type,
        });
      } else if (roomName === 'general') {
        client.emit('roomInfo', {
          name: 'general',
          description: 'General public room',
          type: 'public',
        });
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'getRoomInfo', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('getRooms')
  async handleGetRooms(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const rooms = await this.chatService.getAllPublicRooms();
      client.emit('roomsList', rooms);

      // Also send room count info for the current user
      const username = client.data.user?.username;
      if (username) {
        const roomCount = await this.chatService.getUserRoomCount(username);
        client.emit('roomCountInfo', roomCount);
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'getRooms', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to get rooms' });
    }
  }

  @SubscribeMessage('getRoomById')
  async handleGetRoomById(@MessageBody() data: Dto.RoomIdDto, @ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const room = await this.chatService.getRoomById(data.roomId);
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }
      client.emit('roomInfo', {
        _id: room._id.toString(),
        name: room.name,
        description: room.description,
        type: room.type,
      });
    } catch (err) {
      client.emit('error', { message: 'Failed to fetch room' });
    }
  }
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: Dto.SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;

      if (!username) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }

      const ip = client.handshake.address;

      // 1. SANITIZE INPUT
      let sanitizedMessage: string;
      try {
        sanitizedMessage = InputSanitizer.sanitizeMessage(data.message);
      } catch (error) {
        client.emit('error', { message: 'Invalid message format' });
        return;
      }

      // 2. DETECT INJECTION ATTEMPTS
      if (InputSanitizer.detectInjection(sanitizedMessage)) {
        client.emit('error', { message: 'Invalid message content detected' });
        SecurityLogger.logInjectionAttempt(username, ip, sanitizedMessage, 'message');
        IPBanList.markSuspicious(ip);
        return;
      }

      // 3. CHECK ROOM BAN â€” banned users cannot message even if they slipped past joinRoom
      const isRoomBanned = await this.chatService.isUserBanned(data.room, username);
      if (isRoomBanned) {
        client.emit('error', { message: 'You are banned from this room and cannot send messages.' });
        return;
      }

      // 4. CHECK MUTE STATUS
      const isMuted = await this.chatService.isUserMuted(data.room, username);
      if (isMuted) {
        client.emit('error', { message: 'You have been muted in this room and cannot send messages.' });
        return;
      }

      // 5. CHECK RATE LIMIT
      if (!(await this.checkRateLimit(username, ip))) {
        console.log('[DEBUG] About to emit error with message: - chat.gateway.ts:233', 'Rate limit exceeded. Please slow down.');
        client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        console.log('[DEBUG] Error emitted - chat.gateway.ts:235');
        return;
      }

      // 4. CONTENT MODERATION
      if (ContentModerator.containsProfanity(sanitizedMessage)) {
        client.emit('error', { message: 'Message contains inappropriate content' });
        SecurityLogger.logProfanityDetected(username, 'pending');
        return;
      }

      if (ContentModerator.isSpam(sanitizedMessage)) {
        client.emit('error', { message: 'Spam detected' });
        SecurityLogger.logSpamDetected(username, 'Message flagged as spam');
        return;
      }

      if (ContentModerator.detectPhishing(sanitizedMessage)) {
        client.emit('error', { message: 'Suspicious content detected' });
        SecurityLogger.logPhishingAttempt(username, sanitizedMessage);
        IPBanList.markSuspicious(ip);
        return;
      }

      // 5. DUPLICATE SPAM CHECK
      if (ContentModerator.isDuplicateSpam(username, sanitizedMessage)) {
        client.emit('error', { message: 'Please do not spam the same message' });
        SecurityLogger.logSpamDetected(username, 'Duplicate message spam');
        return;
      }

      // 6. FLOOD DETECTION
      if (ContentModerator.isFlooding(username)) {
        client.emit('error', { message: 'You are sending messages too quickly' });
        SecurityLogger.logSpamDetected(username, 'Message flooding');
        return;
      }

      // 7. SANITIZE MENTIONS
      const mentions = data.mentions?.map((m: string) => {
        try {
          return InputSanitizer.sanitizeUsername(m);
        } catch {
          return null;
        }
      }).filter(Boolean) || [];

      // 8. CHECK EXCESSIVE MENTIONS
      if (ContentModerator.hasExcessiveMentions(mentions)) {
        client.emit('error', { message: 'Too many mentions in one message' });
        return;
      }


      let replyToMessage = null;
      if (data.replyTo) {
        replyToMessage = await this.chatService.getMessageById(data.replyTo);
      }

      // 9. CREATE MESSAGE
      const message = await this.chatService.createMessage({
        room: data.room,
        sender: username,
        message: sanitizedMessage,
        messageType: data.messageType || 'text',
        replyTo: data.replyTo,
        replyToMessage: replyToMessage ? {
          messageId: replyToMessage._id.toString(),
          sender: replyToMessage.sender,
          message: replyToMessage.message.substring(0, 100) // Limit preview length
        } : null,
        mentions,
        readBy: [username],
      });


      // 10. BROADCAST MESSAGE
      this.server.to(data.room).emit('receiveMessage', message);

      // 11. SEND MENTION NOTIFICATIONS
      // 11. SEND MENTION NOTIFICATIONS
      if (mentions.length > 0) {
        for (const mentionedUser of mentions) {
          const roomUsers = await this.chatService.getUsersInRoom(data.room);
          const mentionedUserData = roomUsers.find(u => u.name === mentionedUser);

          // ðŸ”” 1. Real-time socket notification (existing behavior)
          if (mentionedUserData) {
            this.server.to(mentionedUserData.socketId).emit('mention', {
              messageId: message._id,
              mentionedBy: username,
              message: sanitizedMessage,
            });
          }

          // ðŸ’¾ 2. Persistent DB notification (NEW â€“ what you want to add)
          await this.notificationService.createMentionNotification(
            mentionedUser,
            username,
            data.room,
            message._id.toString(),
            sanitizedMessage
          );
        }
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'sendMessage', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to send message' });
    }
  }


  // In chat.gateway.ts, add this handler after handleMessage

  @SubscribeMessage('sendGif')
  async handleSendGif(
    @MessageBody() data: Dto.SendGifDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;

      if (!username) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }
      const ip = client.handshake.address;

      // Check rate limit
      if (!(await this.checkRateLimit(username, ip))) {
        client.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      // Validate URL
      try {
        InputSanitizer.sanitizeUrl(data.gifUrl);
      } catch (error) {
        client.emit('error', { message: 'Invalid GIF URL' });
        return;
      }

      const message = await this.chatService.createMessage({
        room: data.room,
        sender: username,
        message: data.gifUrl,
        messageType: 'gif',
        replyTo: data.replyTo,
        fileData: {
          filename: 'animated.gif',
          originalName: 'Animated GIF',
          mimetype: 'image/gif',
          size: 0,
          url: data.gifUrl,
          width: data.gifData?.width,
          height: data.gifData?.height,
          preview: data.gifData?.preview,
        },
        readBy: [username],
      });

      this.server.to(data.room).emit('receiveMessage', message);
    } catch (error) {
      client.emit('error', { message: 'Failed to send GIF' });
    }
  }



  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() data: Dto.EditMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required to edit messages.' });
        return;
      }
      // Fetch the original message and verify ownership
      const original = await this.chatService.getMessageById(data.messageId);
      if (!original || original.sender !== username) {
        client.emit('error', { message: 'You can only edit your own messages.' });
        return;
      }

      // Sanitize edited message
      const sanitizedMessage = InputSanitizer.sanitizeMessage(data.newMessage);

      if (InputSanitizer.detectInjection(sanitizedMessage)) {
        client.emit('error', { message: 'Invalid message content detected' });
        return;
      }

      const updatedMessage = await this.chatService.editMessage(
        data.messageId,
        sanitizedMessage,
      );

      if (updatedMessage) {
        this.server.to(data.room).emit('messageEdited', updatedMessage);
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'editMessage', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to edit message' });
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() data: Dto.RoomMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required to delete messages.' });
        return;
      }

      const message = await this.chatService.getMessageById(data.messageId);
      if (!message) {
        client.emit('error', { message: 'Message not found.' });
        return;
      }

      const roomDoc = await this.chatService.getRoomByName(data.room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found.' });
        return;
      }

      const isSender = message.sender === username;
      const deleterWeight = await this.chatService.getUserHierarchyWeight(username, data.room);
      const targetWeight = await this.chatService.getUserHierarchyWeight(message.sender, data.room);

      if (!isSender && deleterWeight <= targetWeight) {
        client.emit('error', { message: 'You do not have permission to delete this message.' });
        return;
      }

      await this.chatService.deleteMessage(data.messageId);
      this.server.to(data.room).emit('messageDeleted', {
        messageId: data.messageId,
      });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'deleteMessage', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to delete message' });
    }
  }

  @SubscribeMessage('reactMessage')
  async handleReaction(
    @MessageBody() data: Dto.ReactMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const authUsername = client.data.user?.username;
      if (!authUsername) {
        client.emit('error', { message: 'Authentication required to react to messages.' });
        return;
      }

      let updatedMessage;

      if (data.action === 'add') {
        updatedMessage = await this.chatService.addReaction(
          data.messageId,
          data.emoji,
          authUsername,
        );
      } else {
        updatedMessage = await this.chatService.removeReaction(
          data.messageId,
          data.emoji,
          authUsername,
        );
      }

      if (updatedMessage) {
        this.server.to(data.room).emit('messageReaction', {
          messageId: data.messageId,
          reactions: updatedMessage.reactions,
        });
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'reactMessage', user: client.data.user?.username });
      console.error('Reaction error: - chat.gateway.ts:491', error);
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: Dto.MarkAsReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const authUsername = client.data.user?.username;
      if (!authUsername) return; // Silent fail if not authenticated

      const updatedMessage = await this.chatService.markAsRead(
        data.messageId,
        authUsername,
      );

      if (updatedMessage) {
        this.server.to(data.room).emit('messageRead', {
          messageId: data.messageId,
          readBy: updatedMessage.readBy,
        });
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'markAsRead', user: client.data.user?.username });
      console.error('Mark as read error: - chat.gateway.ts:518', error);
    }
  }

  @SubscribeMessage('markRoomAsRead')
  async handleMarkRoomAsRead(
    @MessageBody() data: Dto.MarkRoomAsReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const authUsername = client.data.user?.username;
      if (!authUsername) return; // Silent fail if not authenticated

      await this.chatService.markRoomAsRead(data.room, authUsername);

      this.server.to(data.room).emit('roomMarkedAsRead', {
        username: authUsername,
      });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'markRoomAsRead', user: client.data.user?.username });
      console.error('Mark room as read error: - chat.gateway.ts:538', error);
    }
  }

  @SubscribeMessage('searchMessages')
  async handleSearchMessages(
    @MessageBody() data: Dto.SearchMessagesDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }

      // Sanitize search query
      const query = InputSanitizer.sanitizeSearchQuery(data.query || '');

      // Detect injection in query
      if (query && InputSanitizer.detectInjection(query)) {
        client.emit('error', { message: 'Invalid search query' });
        SecurityLogger.logInjectionAttempt(
          username,
          client.handshake.address,
          query,
          'search'
        );
        return;
      }

      const results = await this.chatService.searchMessages(data.room, query, 50, data.filters);
      client.emit('searchResults', results);
    } catch (error) {
      SecurityLogger.logError(error, { event: 'searchMessages', user: client.data.user?.username });
      client.emit('error', { message: 'Search failed' });
    }
  }

  @SubscribeMessage('pinMessage')
  async handlePinMessage(
    @MessageBody() data: Dto.RoomMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required to pin messages.' });
        return;
      }

      const roomDoc = await this.chatService.getRoomByName(data.room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found.' });
        return;
      }

      const isGlobalMod = await this.chatService.isGlobalModOrAdmin(username);
      const isPlatformOwner = this.chatService.isOwner(username);
      const isRoomOwner = roomDoc.createdBy === username;
      const isRoomMod = roomDoc.moderators?.includes(username);

      if (!isRoomOwner && !isRoomMod && !isGlobalMod && !isPlatformOwner) {
        client.emit('error', { message: 'You do not have permission to pin messages.' });
        return;
      }

      const pinnedMessage = await this.chatService.pinMessage(data.messageId);

      if (pinnedMessage) {
        this.server.to(data.room).emit('messagePinned', pinnedMessage);
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'pinMessage', user: client.data.user?.username });
      console.error('Pin message error: - chat.gateway.ts:593', error);
    }
  }

  @SubscribeMessage('unpinMessage')
  async handleUnpinMessage(
    @MessageBody() data: Dto.RoomMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required to unpin messages.' });
        return;
      }

      const roomDoc = await this.chatService.getRoomByName(data.room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found.' });
        return;
      }

      const isGlobalMod = await this.chatService.isGlobalModOrAdmin(username);
      const isPlatformOwner = this.chatService.isOwner(username);
      const isRoomOwner = roomDoc.createdBy === username;
      const isRoomMod = roomDoc.moderators?.includes(username);

      if (!isRoomOwner && !isRoomMod && !isGlobalMod && !isPlatformOwner) {
        client.emit('error', { message: 'You do not have permission to unpin messages.' });
        return;
      }

      const unpinnedMessage = await this.chatService.unpinMessage(data.messageId);

      if (unpinnedMessage) {
        this.server.to(data.room).emit('messageUnpinned', {
          messageId: data.messageId,
        });
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'unpinMessage', user: client.data.user?.username });
      console.error('Unpin message error: - chat.gateway.ts:615', error);
    }
  }

  @SubscribeMessage('uploadFile')
  async handleFileUpload(
    @MessageBody() data: Dto.UploadFileDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }
      const ip = client.handshake.address;

      // Check rate limit for file uploads
      if (!(await this.checkRateLimit(username, ip))) {
        client.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const message = await this.chatService.saveFileMessage(
        data.room,
        username,
        data.fileData,
      );

      this.server.to(data.room).emit('receiveMessage', message);
    } catch (error) {
      SecurityLogger.logError(error, { event: 'uploadFile', user: client.data.user?.username });
      console.error('File upload error: - chat.gateway.ts:658', error);
    }
  }

  @SubscribeMessage('reportMessage')
  async handleReportMessage(
    @MessageBody() data: Dto.ReportMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const authUsername = client.data.user?.username;
      if (!authUsername) {
        client.emit('error', { message: 'Authentication required to report messages.' });
        return;
      }

      await this.chatService.updateMessage(data.messageId, {
        isReported: true,
      });

      // Notify moderators
      this.server.to(data.room).emit('messageReported', {
        messageId: data.messageId,
        reportedBy: authUsername,
        reason: data.reason,
      });

      client.emit('reportSuccess', { messageId: data.messageId });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'reportMessage', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to report message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: Dto.TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const username = client.data.user?.username;
    if (!username) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    client.to(data.room).emit('userTyping', {
      username,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('dmTyping')
  async handleDMTyping(
    @MessageBody() data: Dto.DmTypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const username = client.data.user?.username;
    if (!username) return;

    const receiverSockets = await this.chatService.getUserSocketIds(data.receiverUsername);
    for (const socketId of receiverSockets) {
      this.server.to(socketId).emit('dmUserTyping', {
        conversationId: data.conversationId,
        username,
        isTyping: data.isTyping,
      });
    }
  }

  @SubscribeMessage('updateProfile')
  async handleUpdateProfile(
    @MessageBody() data: Dto.UpdateProfileDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const authUsername = client.data.user?.username;

      if (!authUsername || authUsername !== data.username) {
        client.emit('error', { message: 'Unauthorized to update this profile.' });
        return;
      }

      const updatedUser = await this.chatService.updateUserProfile(
        authUsername,
        data.updates,
      );

      if (updatedUser) {
        // Broadcast profile update to all rooms where user is a member
        const rooms = await this.chatService.getRoomsByUser(authUsername);
        rooms.forEach(room => {
          this.server.to(room.name).emit('userProfileUpdated', {
            username: authUsername,
            updates: data.updates,
          });
        });

        client.emit('profileUpdateSuccess', updatedUser);
      } else {
        client.emit('error', { message: 'Failed to update profile. If you are a guest, you must register an account to save a profile.' });
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'updateProfile', user: client.data.user?.username });
      client.emit('error', { message: 'An error occurred while updating the profile.' });
    }
  }

  // Room Management
  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody() data: Dto.CreateRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;

      // 1. Block Guests
      if (!username) {
        return client.emit('error', { message: 'Guests cannot create rooms. Please register an account.' });
      }

      // 2. Eligibility + quota check
      const { allowed, reason } = await this.chatService.canUserCreateRoomWithReason(username);
      if (!allowed) {
        return client.emit('error', { message: reason ?? 'You are not eligible to create rooms.' });
      }

      // Sanitize inputs
      const roomName = InputSanitizer.sanitizeRoomName(data.name);
      const roomType = data.type === 'private' ? 'private' : 'public';

      const room = await this.chatService.createRoom({
        name: roomName,
        description: data.description || '',
        type: roomType,
        createdBy: username,
        members: [username],
        moderators: [],
        isActive: true,
      });

      client.emit('roomCreated', room);

      // Send updated room count to the creator
      const roomCount = await this.chatService.getUserRoomCount(username);
      client.emit('roomCountInfo', roomCount);

      // Only broadcast update if the room is public
      if (room.type === 'public') {
        this.server.emit('roomListUpdated', await this.chatService.getAllPublicRooms());
      }
    } catch (error) {
      client.emit('error', { message: 'Failed to create room' });
    }
  }


  @SubscribeMessage('joinRoomById')
  async handleJoinRoomById(
    @MessageBody() data: Dto.JoinRoomByIdDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const identity = client.data.user;
      if (identity?.type !== 'access' || !identity.userId || !identity.username) {
        client.emit('error', { status: 401, message: 'Authentication required' });
        return;
      }
      const authenticatedUser = await this.chatService.getUserById(identity.userId);
      if (!authenticatedUser || authenticatedUser.username !== identity.username) {
        client.emit('error', { status: 401, message: 'Authentication required' });
        return;
      }
      const username = authenticatedUser.username;

      const room = await this.chatService.getRoomById(data.roomId);
      if (!room) {
        client.emit('error', { status: 404, message: 'Room not found' });
        return;
      }

      // Check room-level ban
      const isBanned = await this.chatService.isUserBanned(room.name, username);
      if (isBanned) {
        client.emit('error', { message: 'You are banned from this room' });
        return;
      }

      // Check private room access â€” invite link only
      if (room.type === 'private') {
        const isMember = room.members?.includes(username);
        if (!isMember) {
          client.emit('error', { status: 403, message: 'Forbidden: you are not a member of this private room' });
          return;
        }
      }

      await this.chatService.addMemberToRoom(room.name, username);

      // Now join the room
      client.join(room.name);
      // Fetch displayName from DB
      let displayName = data.displayName || username;
      const dbUser = await this.chatService.getUserWithRole(username);
      if (dbUser?.displayName) displayName = dbUser.displayName;

      await this.chatService.addUserToRoom(room.name, {
        name: username,
        displayName,
        gender: data.gender,
        country: data.country,
        socketId: client.id,
        isActive: true,
        avatar: data.avatar,
        status: 'online',
      });

      // send an acknowledgement to the joining client
      client.emit('joinedRoom', {
        roomId: room._id.toString(),
        roomName: room.name,
        type: room.type,
        members: await this.chatService.getUsersInRoomWithRoles(room.name),
      });

      // broadcast updateUsers and userJoined to other room members
      this.server.to(room.name).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(room.name));
      this.server.to(room.name).emit('userJoined', { username, room: room.name });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'joinRoomById', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('blockUser')
  async handleBlockUser(
    @MessageBody() data: Dto.TargetUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const blockerUsername = client.data.user?.username;
      if (!blockerUsername) {
        client.emit('error', { message: 'Must be logged in to block users.' });
        return;
      }
      await this.chatService.blockUser(blockerUsername, data.usernameToBlock);
      client.emit('userBlocked', { username: data.usernameToBlock });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'blockUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to block user' });
    }
  }

  @SubscribeMessage('unblockUser')
  async handleUnblockUser(
    @MessageBody() data: Dto.TargetUnblockUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const blockerUsername = client.data.user?.username;
      if (!blockerUsername) {
        client.emit('error', { message: 'Must be logged in to unblock users.' });
        return;
      }
      await this.chatService.unblockUser(blockerUsername, data.usernameToUnblock);
      client.emit('userUnblocked', { username: data.usernameToUnblock });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'unblockUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to unblock user' });
    }
  }

  @SubscribeMessage('reportUser')
  async handleReportUser(
    @MessageBody() data: Dto.ReportUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const reporterUsername = client.data.user?.username;
      if (!reporterUsername) {
        client.emit('error', { message: 'Must be logged in to report users.' });
        return;
      }
      // Assuming a generic report stored somewhere or just logged for moderators
      SecurityLogger.logSpamDetected(data.usernameToReport, `Profile reported by ${reporterUsername} - Reason: ${data.reason || 'None'}`);
      client.emit('userReported', { username: data.usernameToReport });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'reportUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to report user' });
    }
  }

  @SubscribeMessage('inviteUserToRoom')
  async handleInviteUserToRoom(
    @MessageBody() data: Dto.InviteUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const inviterUsername = client.data.user?.username;
      if (!inviterUsername) {
        client.emit('error', { message: 'Must be logged in to invite users.' });
        return;
      }
      const room = await this.chatService.getRoomById(data.roomId);
      if (!room) {
        client.emit('error', { message: 'Room not found.' });
        return;
      }

      // We need to create an actual invite link
      // For now, let's just trigger a notification if we have the service
      // But we need the inviteService to generate a code, which isn't injected directly in gateway yet
      // As a fallback, emit an event that directly alerts the user or creates a simple notification

      this.server.emit('roomInviteReceived', {
        targetUsername: data.targetUsername,
        inviterUsername,
        roomName: room.name,
        roomId: room._id.toString()
      });

      await this.notificationService.createRoomInviteNotification(
        data.targetUsername,
        inviterUsername,
        room.name,
        room._id.toString()
      );

      client.emit('userInvited', { username: data.targetUsername, room: room.name });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'inviteUserToRoom', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to invite user.' });
    }
  }

  @SubscribeMessage('deleteRoom')
  async handleDeleteRoom(
    @MessageBody() data: Dto.DeleteRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const room = await this.chatService.getRoomById(data.roomId);
      if (!room) {
        client.emit('error', { message: 'Room not found.' });
        return;
      }

      const requestUser = client.data.user?.username;
      if (!requestUser) {
        client.emit('error', { message: 'Authentication required to delete a room.' });
        return;
      }

      // ðŸ‘‘ Owner can delete ANY room regardless of ownership
      const isOwner = this.chatService.isOwner(requestUser);
      const isAdmin = await this.chatService.isGlobalModOrAdmin(requestUser);
      if (!isOwner && !isAdmin && room.createdBy !== requestUser) {
        client.emit('error', { message: 'Only the room owner or platform staff can delete rooms.' });
        return;
      }

      await this.chatService.deleteRoom(data.roomId);

      this.server.to(room.name).emit('roomDeleted', { roomId: data.roomId });
      this.server.emit('roomListUpdated', await this.chatService.getAllPublicRooms());
    } catch (error) {
      SecurityLogger.logError(error, { event: 'deleteRoom', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to delete room' });
    }
  }



  // Moderation
  @SubscribeMessage('kickUser')
  async handleKickUser(
    @MessageBody() data: Dto.ModerationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required to perform moderation actions.' });
        return;
      }
      const ip = client.handshake.address;

      const room = InputSanitizer.sanitizeRoomName(data.room);
      const targetUsername = InputSanitizer.sanitizeUsername(data.username);

      const roomDoc = await this.chatService.getRoomByName(room);
      if (!roomDoc) return;

      // ðŸ‘‘ OWNER PROTECTION: Nobody can kick the platform owner
      if (this.chatService.isOwner(targetUsername)) {
        client.emit('error', { message: 'You cannot kick the platform owner.' });
        return;
      }

      // âš–ï¸ HIERARCHY ENGINE: compute weights for both sides (room-aware)
      const actorWeight = await this.chatService.getUserHierarchyWeight(moderator, room);
      const targetWeight = await this.chatService.getUserHierarchyWeight(targetUsername, room);

      // No permission at all (regular user)
      if (actorWeight === 0) {
        client.emit('error', { message: 'You do not have permission to kick users.' });
        SecurityLogger.logSuspiciousActivity(moderator, ip, 'Unauthorized kick attempt', { room, targetUser: targetUsername });
        return;
      }

      // Strict hierarchy: actor must outrank the target
      if (actorWeight <= targetWeight) {
        client.emit('error', { message: 'Hierarchy violation: You cannot kick someone at or above your level.' });
        return;
      }

      // Execute Kick
      const userSocket = await this.chatService.getUserSocketId(room, targetUsername);
      if (userSocket) {
        this.server.to(userSocket).emit('kicked', { room, by: moderator });
        const socket = this.server.sockets.sockets.get(userSocket);
        if (socket) socket.leave(room);
      }

      await this.chatService.removeUserFromRoom(room, targetUsername);
      this.server.to(room).emit('userKicked', { username: targetUsername, by: moderator });
      this.server.to(room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(room));

      await this.notificationService.createKickedNotification(targetUsername, moderator, room);
      await this.chatService.logModerationAction('kick', moderator, targetUsername, room);

    } catch (error) {
      SecurityLogger.logError(error, { event: 'kickUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to kick user' });
    }
  }




  @SubscribeMessage('banUser')
  async handleBanUser(
    @MessageBody() data: Dto.BanUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required to perform moderation actions.' });
        return;
      }
      const ip = client.handshake.address;

      const room = InputSanitizer.sanitizeRoomName(data.room);
      const username = InputSanitizer.sanitizeUsername(data.username);

      const roomDoc = await this.chatService.getRoomByName(room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      // ðŸ‘‘ OWNER PROTECTION: Nobody can ban the platform owner
      if (this.chatService.isOwner(username)) {
        client.emit('error', { message: 'You cannot ban the platform owner.' });
        return;
      }

      // âš–ï¸ HIERARCHY ENGINE
      const actorWeight = await this.chatService.getUserHierarchyWeight(moderator, room);
      const targetWeight = await this.chatService.getUserHierarchyWeight(username, room);

      if (actorWeight === 0) {
        client.emit('error', { message: 'You do not have permission to ban users.' });
        SecurityLogger.logSuspiciousActivity(moderator, ip, 'Unauthorized ban attempt', { room, targetUser: username });
        return;
      }
      if (actorWeight <= targetWeight) {
        client.emit('error', { message: 'Hierarchy violation: You cannot ban someone at or above your level.' });
        return;
      }

      // Execute Ban
      await this.chatService.banUserFromRoom(room, username, moderator, data.reason, data.duration);

      const userSockets = await this.chatService.getUserSocketIds(username);
      for (const socketId of userSockets) {
        this.server.to(socketId).emit('banned', { room, by: moderator, reason: data.reason, duration: data.duration });
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) socket.leave(room);
      }

      await this.chatService.removeUserFromRoom(room, username);
      this.server.to(room).emit('userBanned', { username, by: moderator, reason: data.reason, duration: data.duration });
      this.server.to(room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(room));

      await this.notificationService.createBannedNotification(username, moderator, room);
      await this.chatService.logModerationAction('ban', moderator, username, room, data.reason);
      SecurityLogger.logUserBanned(moderator, username, room, data.reason);

    } catch (error) {
      SecurityLogger.logError(error, { event: 'banUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to ban user' });
    }
  }



  @SubscribeMessage('muteUser')
  async handleMuteUser(
    @MessageBody() data: Dto.ModerationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required to perform moderation actions.' });
        return;
      }
      const ip = client.handshake.address;

      const room = InputSanitizer.sanitizeRoomName(data.room);
      const targetUsername = InputSanitizer.sanitizeUsername(data.username);

      const roomDoc = await this.chatService.getRoomByName(room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      // ðŸ‘‘ OWNER PROTECTION: Nobody can mute the platform owner
      if (this.chatService.isOwner(targetUsername)) {
        client.emit('error', { message: 'You cannot mute the platform owner.' });
        return;
      }

      // âš–ï¸ HIERARCHY ENGINE
      const actorWeight = await this.chatService.getUserHierarchyWeight(moderator, room);
      const targetWeight = await this.chatService.getUserHierarchyWeight(targetUsername, room);

      if (actorWeight === 0) {
        client.emit('error', { message: 'You do not have permission to mute users.' });
        SecurityLogger.logSuspiciousActivity(moderator, ip, 'Unauthorized mute attempt', { room, targetUser: targetUsername });
        return;
      }
      if (actorWeight <= targetWeight) {
        client.emit('error', { message: 'Hierarchy violation: You cannot mute someone at or above your level.' });
        return;
      }

      // Execute mute
      await this.chatService.muteUser(room, targetUsername);

      const userSocket = await this.chatService.getUserSocketId(room, targetUsername);
      if (userSocket) {
        this.server.to(userSocket).emit('muted', { room, by: moderator, reason: data.reason });
      }

      this.server.to(room).emit('userMuted', { username: targetUsername, by: moderator, reason: data.reason });
      this.server.to(room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(room));
      await this.notificationService.createMutedNotification(targetUsername, moderator, room, data.reason);
      await this.chatService.logModerationAction('mute', moderator, targetUsername, room, data.reason);

    } catch (error) {
      SecurityLogger.logError(error, { event: 'muteUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to mute user' });
    }
  }

  @SubscribeMessage('unmuteUser')
  async handleUnmuteUser(
    @MessageBody() data: Dto.ModerationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required to perform moderation actions.' });
        return;
      }
      const ip = client.handshake.address;

      const room = InputSanitizer.sanitizeRoomName(data.room);
      const targetUsername = InputSanitizer.sanitizeUsername(data.username);

      const roomDoc = await this.chatService.getRoomByName(room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      // âš–ï¸ HIERARCHY ENGINE
      const actorWeight = await this.chatService.getUserHierarchyWeight(moderator, room);
      const targetWeight = await this.chatService.getUserHierarchyWeight(targetUsername, room);

      if (actorWeight === 0) {
        client.emit('error', { message: 'You do not have permission to unmute users.' });
        SecurityLogger.logSuspiciousActivity(moderator, ip, 'Unauthorized unmute attempt', { room, targetUser: targetUsername });
        return;
      }
      if (actorWeight <= targetWeight) {
        client.emit('error', { message: 'Hierarchy violation: You cannot unmute someone at or above your level.' });
        return;
      }

      await this.chatService.unmuteUser(room, targetUsername);

      const userSocket = await this.chatService.getUserSocketId(room, targetUsername);
      if (userSocket) {
        this.server.to(userSocket).emit('unmuted', { room, by: moderator });
      }

      this.server.to(room).emit('userUnmuted', { username: targetUsername, by: moderator });
      this.server.to(room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(room));
    } catch (error) {
      SecurityLogger.logError(error, { event: 'unmuteUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to unmute user' });
    }
  }

  // --- NEW: Unban User from Room ---
  @SubscribeMessage('unbanUser')
  async handleUnbanUser(
    @MessageBody() data: Dto.ModerationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      const room = InputSanitizer.sanitizeRoomName(data.room);
      const username = InputSanitizer.sanitizeUsername(data.username);

      const roomDoc = await this.chatService.getRoomByName(room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      // ðŸ‘‘ Owner can unban anyone anywhere
      const isActorOwner = this.chatService.isOwner(moderator);
      const isActorGlobalMod = await this.chatService.isGlobalModOrAdmin(moderator);

      // Get ban metadata (who placed the ban)
      const activeBans = await this.chatService.getRoomBans(room);
      const userBan = activeBans.find(b => b.username === username);

      if (userBan) {
        const bannedBy = userBan.bannedBy;
        const bannedByIsOwner = this.chatService.isOwner(bannedBy);
        const bannedByIsGlobalMod = await this.chatService.isGlobalModOrAdmin(bannedBy);

        if ((bannedByIsOwner || bannedByIsGlobalMod) && !isActorOwner && !isActorGlobalMod) {
          client.emit('error', { message: 'You do not have permission to unban a user banned by platform staff.' });
          return;
        }
      }

      const canUnban = isActorOwner || isActorGlobalMod || roomDoc.createdBy === moderator || roomDoc.moderators?.includes(moderator);
      if (!canUnban) {
        client.emit('error', { message: 'You do not have permission to unban users' });
        return;
      }

      await this.chatService.unbanUserFromRoom(room, username);

      await this.notificationService.createUnbannedNotification(
        username,
        room,
        moderator
      );

      this.server.to(room).emit('userUnbanned', { username, by: moderator });
      client.emit('unbanSuccess', { username, room });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'unbanUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to unban user' });
    }
  }

  // --- NEW: Get Room Bans ---
  @SubscribeMessage('getRoomBans')
  async handleGetRoomBans(
    @MessageBody() data: Dto.RoomInfoDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      const roomDoc = await this.chatService.getRoomByName(data.room);
      if (!roomDoc) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      const canView = roomDoc.createdBy === username ||
        roomDoc.moderators?.includes(username) ||
        await this.chatService.isGlobalModOrAdmin(username) ||
        this.chatService.isOwner(username);

      if (!canView) {
        client.emit('error', { message: 'You do not have permission to view bans' });
        return;
      }

      const bans = await this.chatService.getRoomBans(data.room);
      client.emit('roomBans', { room: data.room, bans });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'getRoomBans', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to get room bans' });
    }
  }

  // --- NEW: Platform Ban (Global Mod/Admin only) ---
  @SubscribeMessage('platformBan')
  async handlePlatformBan(
    @MessageBody() data: Dto.PlatformBanDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      const targetUsername = InputSanitizer.sanitizeUsername(data.username);

      // ðŸ‘‘ OWNER PROTECTION: Nobody can platform-ban the owner
      if (this.chatService.isOwner(targetUsername)) {
        client.emit('error', { message: 'You cannot platform-ban the platform owner.' });
        SecurityLogger.logSuspiciousActivity(
          moderator, client.handshake.address,
          'Attempted platform-ban of Owner', { targetUser: targetUsername }
        );
        return;
      }

      // ðŸ‘‘ Owner can platform-ban anyone without needing globalMod role
      const isActorOwner = this.chatService.isOwner(moderator);
      const isGlobalMod = await this.chatService.isGlobalModOrAdmin(moderator);
      if (!isActorOwner && !isGlobalMod) {
        client.emit('error', { message: 'Only global moderators and admins can platform-ban users.' });
        SecurityLogger.logSuspiciousActivity(
          moderator, client.handshake.address,
          'Unauthorized platform ban attempt', { targetUser: targetUsername }
        );
        return;
      }

      // Cannot platform-ban another global mod/admin (unless actor is Owner)
      const targetIsGlobalMod = await this.chatService.isGlobalModOrAdmin(targetUsername);
      if (targetIsGlobalMod && !isActorOwner) {
        client.emit('error', { message: 'You cannot platform-ban another global moderator or admin.' });
        return;
      }

      await this.chatService.banUserPlatform(targetUsername, true);

      // Disconnect the banned user from all rooms
      for (const [, socket] of this.server.sockets.sockets) {
        const authSocket = socket as AuthenticatedSocket;
        if (authSocket.data.user?.username === targetUsername) {
          authSocket.emit('platformBanned', { by: moderator, reason: data.reason });
          authSocket.disconnect(true);
        }
      }

      await this.notificationService.createPlatformBannedNotification(
        targetUsername,
        moderator,
        data.reason
      );

      client.emit('platformBanSuccess', { username: targetUsername });
      SecurityLogger.logUserBanned(moderator, targetUsername, 'PLATFORM', data.reason);
    } catch (error) {
      SecurityLogger.logError(error, { event: 'platformBan', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to platform-ban user' });
    }
  }

  @SubscribeMessage('promoteUser')
  async handlePromoteUser(
    @MessageBody() data: Dto.PromoteUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const moderator = client.data.user?.username;
      if (!moderator) {
        client.emit('error', { message: 'Authentication required to perform moderation actions.' });
        return;
      }

      const room = await this.chatService.getRoomByName(data.room);
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      // Security checks: actor identity & hierarchy
      const isPlatformOwner = this.chatService.isOwner(moderator);
      const isGlobalMod = await this.chatService.isGlobalModOrAdmin(moderator);
      const isRoomOwner = room.createdBy === moderator;

      if (!isPlatformOwner && !isRoomOwner && !isGlobalMod) {
        client.emit('error', { message: 'You do not have permission to change user roles.' });
        SecurityLogger.logSuspiciousActivity(moderator, client.handshake.address, 'Unauthorized promote attempt', {
          room: data.room,
          targetUser: data.username,
          targetRole: data.role
        });
        return;
      }

      // Check target existence and ban state
      const targetUserDoc = await this.chatService.getUserByUsername(data.username);
      if (!targetUserDoc) {
        client.emit('error', { message: 'Target user not found' });
        return;
      }

      // Email verified check
      if (!targetUserDoc.isVerified) {
        client.emit('error', { message: 'Only users with verified emails can be promoted to moderator or admin.' });
        return;
      }

      // Platform-ban check (cannot promote someone globally banned)
      if (targetUserDoc.isPlatformBanned) {
        client.emit('error', { message: 'Cannot change roles for a platform-banned user.' });
        return;
      }

      // Room-ban check â€” if they're banned from the room, disallow room-level promotions
      const isRoomBanned = await this.chatService.isUserBanned(data.room, data.username);
      if (isRoomBanned) {
        client.emit('error', { message: 'Target user is banned from the room.' });
        return;
      }

      // Handle global admin promotion/demotion
      if (data.role === 'admin') {
        // Only platform owner can grant global admin
        if (!isPlatformOwner) {
          client.emit('error', { message: 'Only the platform owner can promote users to admin.' });
          return;
        }

        // Set globalRole: 'admin'
        await this.chatService.updateUserProfile(data.username, { globalRole: 'admin' });

        await this.notificationService.createPromotedNotification(
          data.username,
          moderator,
          data.room,
          'admin'
        );

        this.server.emit('userPromoted', {
          username: data.username,
          role: 'admin',
          by: moderator,
        });

        // Broadcast updated users/roles for the room so clients refresh
        this.server.to(data.room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(data.room));
        return;
      }

      // If data.role === 'member' and target is global admin -> treat as demote from admin (only owner allowed)
      if (data.role === 'member' && targetUserDoc.globalRole === 'admin') {
        if (!isPlatformOwner) {
          client.emit('error', { message: 'Only the platform owner can remove global admin status.' });
          return;
        }

        await this.chatService.updateUserProfile(data.username, { globalRole: 'user' });

        await this.notificationService.createPromotedNotification(
          data.username,
          moderator,
          data.room,
          'admin_removed'
        );

        this.server.emit('userPromoted', {
          username: data.username,
          role: 'admin_removed',
          by: moderator,
        });

        this.server.to(data.room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(data.room));
        return;
      }

      // Room-level promotions/demotions: moderator/member
      if (data.role === 'moderator') {
        await this.chatService.promoteUser(data.room, data.username, 'moderator');

        await this.notificationService.createPromotedNotification(
          data.username,
          moderator,
          data.room,
          'moderator'
        );

        this.server.to(data.room).emit('userPromoted', {
          username: data.username,
          role: 'moderator',
          by: moderator
        });

        this.server.to(data.room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(data.room));
        return;
      }

      if (data.role === 'member') {
        // handle removal of moderator role in room (if exists)
        await this.chatService.promoteUser(data.room, data.username, 'member');

        this.server.to(data.room).emit('userPromoted', {
          username: data.username,
          role: 'member',
          by: moderator
        });

        this.server.to(data.room).emit('updateUsers', await this.chatService.getUsersInRoomWithRoles(data.room));
        return;
      }

    } catch (error) {
      SecurityLogger.logError(error, { event: 'promoteUser', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to change user role' });
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: Dto.ModerationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }
      const room = InputSanitizer.sanitizeRoomName(data.room);

      client.leave(room);
      await this.chatService.removeUserFromRoom(room, username);

      this.server.to(room).emit('userEvent', {
        type: 'leave',
        username: username,
      });

      this.server.to(room).emit(
        'updateUsers',
        await this.chatService.getUsersInRoomWithRoles(room),
      );
    } catch (error) {
      SecurityLogger.logError(error, { event: 'leaveRoom', user: client.data.user?.username });
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    // Unregister socket for DM delivery
    const username = client.data.user?.username;
    if (username) {
      await this.chatService.unregisterUserSocket(username, client.id);

      // If no other tabs/devices are connected for this user, mark as offline
      const remainingIds = await this.chatService.getUserSocketIds(username);
      if (remainingIds.length === 0) {
        await this.chatService.updateUserStatus(username, 'offline');
      }
    }

    const results = await this.chatService.getRoomsBySocket(client.id);

    for (const { room, user } of results) {
      await this.chatService.removeUserFromRoom(room, user.name);

      this.server.to(room).emit('userEvent', {
        type: 'leave',
        username: user.name,
      });

      this.server.to(room).emit(
        'updateUsers',
        await this.chatService.getUsersInRoomWithRoles(room),
      );
    }
  }

  // ==================== DM SYSTEM ====================

  @SubscribeMessage('startDM')
  async handleStartDM(
    @MessageBody() data: Dto.StartDmDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      // Only authenticated users can start DMs (no guest fallback)
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'You must be logged in to send direct messages.' });
        return;
      }

      if (username === data.targetUsername) {
        client.emit('error', { message: 'You cannot DM yourself.' });
        return;
      }

      // Check if target user exists
      const targetUser = await this.chatService.getUserByUsername(data.targetUsername);
      if (!targetUser) {
        client.emit('error', { message: 'User not found.' });
        return;
      }

      // Check blocks (both directions)
      const isBlockedByTarget = await this.chatService.isUserBlocked(data.targetUsername, username);
      if (isBlockedByTarget) {
        client.emit('dmBlocked', {
          targetUsername: data.targetUsername,
          direction: 'blockedByTarget',
          message: 'This user has blocked you.',
          targetUser: {
            username: targetUser.username,
            avatar: targetUser.avatar,
            displayName: targetUser.displayName,
            status: targetUser.status || 'offline',
          }
        });
        return;
      }

      const hasBlockedTarget = await this.chatService.isUserBlocked(username, data.targetUsername);
      if (hasBlockedTarget) {
        client.emit('dmBlocked', {
          targetUsername: data.targetUsername,
          direction: 'blockedByYou',
          message: 'You have blocked this user. Unblock them to send messages.',
          targetUser: {
            username: targetUser.username,
            avatar: targetUser.avatar,
            displayName: targetUser.displayName,
            status: targetUser.status || 'offline',
          }
        });
        return;
      }

      const conversation = await this.chatService.getOrCreateDMConversation(username, data.targetUsername);

      // Load recent messages
      const messages = await this.chatService.getDMMessages(conversation._id.toString(), 50);

      // ✅ FIX: Enrich conversation with otherUser data (matches getDMConversations format)
      const enrichedConversation = {
        ...conversation.toObject(),
        otherUser: {
          username: targetUser.username,
          avatar: targetUser.avatar,
          status: targetUser.status || 'offline',
          displayName: targetUser.displayName,
          bio: targetUser.bio,
        },
        unreadCount: 0, // Starting a DM, unread is 0 for the initiator
      };

      client.emit('dmConversationStarted', {
        conversation: enrichedConversation,
        messages: messages.reverse(),
      });
    } catch (error) {
      console.error('âŒ startDM error:', error);
      SecurityLogger.logError(error, { event: 'startDM', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to start DM.' });
    }
  }

  @SubscribeMessage('sendDMMessage')
  async handleSendDMMessage(
    @MessageBody() data: Dto.SendDmMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'You must be logged in to send direct messages.' });
        return;
      }

      const ip = client.handshake.address;

      // Rate limit check
      if (!(await this.checkRateLimit(username, ip))) {
        client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        return;
      }

      // Check blocks
      const isBlockedByReceiver = await this.chatService.isUserBlocked(data.receiver, username);
      if (isBlockedByReceiver) {
        client.emit('dmBlocked', {
          targetUsername: data.receiver,
          direction: 'blockedByTarget',
          message: 'This user has blocked you.',
        });
        client.emit('error', { message: 'You cannot message this user.' });
        return;
      }

      // Sanitize message
      let sanitizedMessage: string;
      try {
        sanitizedMessage = InputSanitizer.sanitizeMessage(data.message);
      } catch {
        client.emit('error', { message: 'Invalid message format.' });
        return;
      }

      // Content moderation
      if (ContentModerator.containsProfanity(sanitizedMessage)) {
        client.emit('error', { message: 'Message contains inappropriate content.' });
        return;
      }

      // Build reply context
      let replyToMessage = null;
      if (data.replyTo) {
        const replyMsg = await this.chatService.getDMMessageById(data.replyTo);
        if (replyMsg) {
          replyToMessage = {
            messageId: replyMsg._id.toString(),
            sender: replyMsg.sender,
            message: replyMsg.message.substring(0, 100),
          };
        }
      }

      const dmMessage = await this.chatService.sendDMMessage(
        data.conversationId,
        username,
        data.receiver,
        sanitizedMessage,
        data.messageType || 'text',
        data.fileData,
        data.replyTo,
        replyToMessage,
      );

      // Emit to sender
      client.emit('receiveDMMessage', dmMessage);

      // Emit to receiver's active sockets
      const receiverSockets = await this.chatService.getUserSocketIds(data.receiver);
      for (const socketId of receiverSockets) {
        this.server.to(socketId).emit('receiveDMMessage', dmMessage);
        // Also notify receiver of conversation update
        this.server.to(socketId).emit('dmConversationUpdated', {
          conversationId: data.conversationId,
          lastMessage: sanitizedMessage.substring(0, 100),
          lastMessageSender: username,
          lastMessageAt: new Date(),
        });
      }

      // Delivery confirmation - if receiver is online, mark as delivered
      if (receiverSockets.length > 0) {
        await this.chatService.markDMMessageDelivered(dmMessage._id.toString());
        client.emit('dmMessageDelivered', {
          conversationId: data.conversationId,
          messageId: dmMessage._id.toString(),
          deliveredAt: new Date().toISOString(),
        });
      }

      // Add DM notification
      await this.notificationService.createDMReceivedNotification(
        data.receiver,
        username,
        data.conversationId
      );
    } catch (error) {
      SecurityLogger.logError(error, { event: 'sendDMMessage', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to send DM.' });
    }
  }

  @SubscribeMessage('getDMConversations')
  async handleGetDMConversations(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      const conversations = await this.chatService.getDMConversations(username);
      client.emit('dmConversationsList', conversations);
    } catch (error) {
      SecurityLogger.logError(error, { event: 'getDMConversations', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to load DM conversations.' });
    }
  }

  @SubscribeMessage('loadDMMessages')
  async handleLoadDMMessages(
    @MessageBody() data: Dto.LoadDmMessagesDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      const messages = await this.chatService.getDMMessages(
        data.conversationId,
        50,
        data.skip || 0,
      );

      client.emit('dmMessagesLoaded', {
        conversationId: data.conversationId,
        messages: messages.reverse(),
      });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'loadDMMessages', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to load DM messages.' });
    }
  }

  @SubscribeMessage('markDMAsRead')
  async handleMarkDMAsRead(
    @MessageBody() data: Dto.ConversationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;

      await this.chatService.markDMAsRead(data.conversationId, username);
      client.emit('dmRead', { conversationId: data.conversationId });

      // Notify the other participant (the sender) that messages were read
      const conversation = await this.chatService.getDMConversationById(data.conversationId);
      if (conversation) {
        const otherUser = conversation.participants.find((p: string) => p !== username);
        if (otherUser) {
          const senderSockets = await this.chatService.getUserSocketIds(otherUser);
          for (const socketId of senderSockets) {
            this.server.to(socketId).emit('dmMessagesRead', {
              conversationId: data.conversationId,
              readBy: username,
              readAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'markDMAsRead', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('deleteDMConversation')
  async handleDeleteDMConversation(
    @MessageBody() data: Dto.ConversationDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      await this.chatService.deleteDMConversation(data.conversationId, username);
      client.emit('dmConversationDeleted', { conversationId: data.conversationId });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'deleteDMConversation', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to delete DM conversation.' });
    }
  }

  @SubscribeMessage('pinDMMessage')
  async handlePinDMMessage(
    @MessageBody() data: Dto.DmMessageRefDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;
      const pinned = await this.chatService.pinDMMessage(data.messageId);
      if (pinned) {
        client.emit('dmMessagePinned', { conversationId: data.conversationId, messageId: data.messageId });
        const conversation = await this.chatService.getDMConversationById(data.conversationId);
        if (conversation) {
          const otherUser = conversation.participants.find((p: string) => p !== username);
          if (otherUser) {
            const otherSockets = await this.chatService.getUserSocketIds(otherUser);
            for (const s of otherSockets) {
              this.server.to(s).emit('dmMessagePinned', { conversationId: data.conversationId, messageId: data.messageId });
            }
          }
        }
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'pinDMMessage', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('unpinDMMessage')
  async handleUnpinDMMessage(
    @MessageBody() data: Dto.DmMessageRefDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;
      const unpinned = await this.chatService.unpinDMMessage(data.messageId);
      if (unpinned) {
        client.emit('dmMessageUnpinned', { conversationId: data.conversationId, messageId: data.messageId });
        const conversation = await this.chatService.getDMConversationById(data.conversationId);
        if (conversation) {
          const otherUser = conversation.participants.find((p: string) => p !== username);
          if (otherUser) {
            const otherSockets = await this.chatService.getUserSocketIds(otherUser);
            for (const s of otherSockets) {
              this.server.to(s).emit('dmMessageUnpinned', { conversationId: data.conversationId, messageId: data.messageId });
            }
          }
        }
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'unpinDMMessage', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('reportDMMessage')
  async handleReportDMMessage(
    @MessageBody() data: Dto.DmMessageRefDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;
      const reported = await this.chatService.reportDMMessage(data.messageId);
      if (reported) {
        client.emit('dmMessageReported', { conversationId: data.conversationId, messageId: data.messageId });
      }
    } catch (error) {
      SecurityLogger.logError(error, { event: 'reportDMMessage', user: client.data.user?.username });
    }
  }
  @SubscribeMessage('reactDMMessage')
  async handleReactDM(
    @MessageBody() data: Dto.ReactDmDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;

      let msg;
      if (data.action === 'add') {
        msg = await this.chatService.addDMReaction(data.messageId, data.emoji, username);
      } else {
        msg = await this.chatService.removeDMReaction(data.messageId, data.emoji, username);
      }

      if (msg) {
        const conversation = await this.chatService.getDMConversationById(data.conversationId);
        if (conversation) {
          const participants = conversation.participants;
          for (const p of participants) {
            const sockets = await this.chatService.getUserSocketIds(p);
            sockets.forEach(s => this.server.to(s).emit('dmMessageReaction', { messageId: data.messageId, reactions: msg.reactions }));
          }
        }
      }
    } catch (e) {
      SecurityLogger.logError(e, { event: 'reactDMMessage', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('deleteDMMessage')
  async handleDeleteDMMessage(
    @MessageBody() data: Dto.DmMessageRefDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;

      const success = await this.chatService.softDeleteDMMessage(data.messageId, username);
      if (success) {
        const conversation = await this.chatService.getDMConversationById(data.conversationId);
        if (conversation) {
          for (const p of conversation.participants) {
            const sockets = await this.chatService.getUserSocketIds(p);
            sockets.forEach(s => this.server.to(s).emit('dmMessageDeleted', { messageId: data.messageId }));
          }
        }
      }
    } catch (e) {
      SecurityLogger.logError(e, { event: 'deleteDMMessage', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('editDMMessage')
  async handleEditDMMessage(
    @MessageBody() data: Dto.EditDmDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;

      const sanitized = InputSanitizer.sanitizeMessage(data.newMessage);
      const msg = await this.chatService.editDMMessage(data.messageId, sanitized, username);
      if (msg) {
        const conversation = await this.chatService.getDMConversationById(data.conversationId);
        if (conversation) {
          for (const p of conversation.participants) {
            const sockets = await this.chatService.getUserSocketIds(p);
            sockets.forEach(s => this.server.to(s).emit('dmMessageEdited', { message: msg }));
          }
        }
      }
    } catch (e) {
      SecurityLogger.logError(e, { event: 'editDMMessage', user: client.data.user?.username });
    }
  }

  @SubscribeMessage('sendDMGif')
  async handleSendDMGif(
    @MessageBody() data: Dto.SendDmGifDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      const dmMessage = await this.chatService.sendDMMessage(
        data.conversationId, username, data.receiver, data.gifUrl, 'gif', data.gifData
      );

      client.emit('receiveDMMessage', dmMessage);
      const receiverSockets = await this.chatService.getUserSocketIds(data.receiver);
      for (const s of receiverSockets) {
        this.server.to(s).emit('receiveDMMessage', dmMessage);
      }

      // Notify receiver of conversation update
      for (const s of receiverSockets) {
        this.server.to(s).emit('dmConversationUpdated', {
          conversationId: data.conversationId,
          lastMessage: 'Sent a GIF',
          lastMessageSender: username,
          lastMessageAt: new Date(),
        });
      }

      // Delivery confirmation
      if (receiverSockets.length > 0) {
        await this.chatService.markDMMessageDelivered(dmMessage._id.toString());
        client.emit('dmMessageDelivered', {
          conversationId: data.conversationId,
          messageId: dmMessage._id.toString(),
          deliveredAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      SecurityLogger.logError(e, { event: 'sendDMGif', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to send GIF.' });
    }
  }

  @SubscribeMessage('uploadDMFile')
  async handleUploadDMFile(
    @MessageBody() data: Dto.UploadDmFileDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      let msgType = 'file';
      if (data.fileData.mimetype?.startsWith('image/')) msgType = 'image';
      if (data.fileData.mimetype?.startsWith('audio/')) msgType = 'voice';

      const dmMessage = await this.chatService.sendDMMessage(
        data.conversationId, username, data.receiver, 'Sent a file', msgType, data.fileData
      );

      client.emit('receiveDMMessage', dmMessage);
      const receiverSockets = await this.chatService.getUserSocketIds(data.receiver);
      for (const s of receiverSockets) {
        this.server.to(s).emit('receiveDMMessage', dmMessage);
      }

      // Notify receiver of conversation update
      for (const s of receiverSockets) {
        this.server.to(s).emit('dmConversationUpdated', {
          conversationId: data.conversationId,
          lastMessage: msgType === 'image' ? 'Sent an image' : 'Sent a file',
          lastMessageSender: username,
          lastMessageAt: new Date(),
        });
      }

      // Delivery confirmation
      if (receiverSockets.length > 0) {
        await this.chatService.markDMMessageDelivered(dmMessage._id.toString());
        client.emit('dmMessageDelivered', {
          conversationId: data.conversationId,
          messageId: dmMessage._id.toString(),
          deliveredAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      SecurityLogger.logError(e, { event: 'uploadDMFile', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to send file.' });
    }
  }

  @SubscribeMessage('getUserProfile')
  async handleGetUserProfile(
    @MessageBody() data: Dto.UserProfileDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const profile = await this.chatService.getUserFullProfile(data.username);
      if (!profile) {
        client.emit('userProfileError', { message: 'User not found.' });
        return;
      }

      const requester = client.data.user?.username;
      let isFriend = false;
      let isBlocked = false;

      if (requester && requester !== data.username) {
        isFriend = await this.chatService.areFriends(requester, data.username);
        isBlocked = await this.chatService.isUserBlocked(requester, data.username);
      }

      client.emit('userProfileData', { ...profile, isFriend, isBlocked });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'getUserProfile', user: client.data.user?.username });
      client.emit('userProfileError', { message: 'Failed to load profile.' });
    }
  }

  @SubscribeMessage('uploadAvatar')
  async handleUploadAvatar(
    @MessageBody() data: Dto.ImageUploadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      // Convert base64 to buffer
      const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const file: Express.Multer.File = {
        buffer,
        originalname: data.filename || 'avatar.png',
        mimetype: 'image/png',
        size: buffer.length,
      } as Express.Multer.File;

      const avatarPath = await this.uploadService.validateAndUploadAvatar(file);

      // Build full URL
      const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
      const avatarUrl = `${baseUrl}${avatarPath}`;

      // Update user in DB
      await this.chatService.updateUserProfile(username, { avatar: avatarUrl });

      client.emit('avatarUpdated', { avatarUrl });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'uploadAvatar', user: client.data.user?.username });
      client.emit('error', { message: 'Failed to upload avatar.' });
    }
  }

  @SubscribeMessage('uploadCoverPhoto')
  async handleUploadCoverPhoto(
    @MessageBody() data: Dto.ImageUploadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'Authentication required.' });
        return;
      }

      // Convert base64 to buffer
      const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const file: Express.Multer.File = {
        buffer,
        originalname: data.filename || 'cover.png',
        mimetype: 'image/png',
        size: buffer.length,
      } as Express.Multer.File;

      const coverPath = await this.uploadService.validateAndUploadAvatar(file); // reusing avatar validation for now

      // Build full URL
      const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
      const coverUrl = `${baseUrl}${coverPath}`;

      // Update user in DB
      await this.chatService.updateUserProfile(username, { coverPhoto: coverUrl });

      client.emit('coverPhotoUpdated', { coverUrl });

      // Broadcast cover update to all rooms the user is in
      const rooms = await this.chatService.getRoomsByUser(username);
      rooms.forEach(room => {
        this.server.to(room.name).emit('userProfileUpdated', {
          username,
          updates: { coverPhoto: coverUrl },
        });
      });
    } catch (error) {
      SecurityLogger.logError(error, { event: 'uploadAvatar', user: client.data.user?.username });
      client.emit('error', { message: error.message || 'Failed to upload avatar.' });
    }
  }

  // ==================== FRIEND SYSTEM ====================

  @SubscribeMessage('sendFriendRequest')
  async handleSendFriendRequest(
    @MessageBody() data: Dto.FriendRequestDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'You must be logged in to send friend requests.' });
        return;
      }
      if (username === data.targetUsername) {
        client.emit('error', { message: 'You cannot add yourself as a friend.' });
        return;
      }

      const targetUser = await this.chatService.getUserByUsername(data.targetUsername);
      if (!targetUser) {
        client.emit('error', { message: 'User not found.' });
        return;
      }

      const request = await this.chatService.sendFriendRequest(username, data.targetUsername);

      if (request.status === 'accepted') {
        // Auto-accepted (mutual request)
        client.emit('friendRequestResponse', { status: 'accepted', friend: data.targetUsername });
        // Notify other user
        const targetSocketIds = await this.chatService.getUserSocketIds(data.targetUsername);
        for (const sid of targetSocketIds) {
          this.server.to(sid).emit('friendRequestAccepted', { friend: username });
        }
        if (targetSocketIds.length > 0) {
          const targetFriends = await this.chatService.getFriends(data.targetUsername);
          for (const sid of targetSocketIds) {
            this.server.to(sid).emit('friendsList', targetFriends);
          }
        }
        client.emit('friendsList', await this.chatService.getFriends(username));
      } else {
        client.emit('friendRequestSent', { to: data.targetUsername });

        await this.notificationService.createFriendRequestNotification(
          data.targetUsername,
          username
        );

        // Notify target about the request
        const targetSocketIds = await this.chatService.getUserSocketIds(data.targetUsername);
        if (targetSocketIds.length > 0) {
          const requests = await this.chatService.getFriendRequests(data.targetUsername);
          for (const sid of targetSocketIds) {
            this.server.to(sid).emit('friendRequestsList', requests);
          }
        }
      }
    } catch (error) {
      client.emit('error', { message: error.message || 'Failed to send friend request.' });
    }
  }

  @SubscribeMessage('respondFriendRequest')
  async handleRespondFriendRequest(
    @MessageBody() data: Dto.RespondFriendRequestDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'You must be logged in.' });
        return;
      }

      const request = await this.chatService.respondToFriendRequest(data.requestId, username, data.action);
      if (!request) {
        client.emit('error', { message: 'Friend request not found.' });
        return;
      }

      // Refresh both users' data
      client.emit('friendRequestsList', await this.chatService.getFriendRequests(username));
      client.emit('friendsList', await this.chatService.getFriends(username));

      if (data.action === 'accept') {
        await this.notificationService.createFriendAcceptedNotification(
          request.from,
          username
        );

        const senderSocketIds = await this.chatService.getUserSocketIds(request.from);
        if (senderSocketIds.length > 0) {
          const senderFriends = await this.chatService.getFriends(request.from);
          for (const sid of senderSocketIds) {
            this.server.to(sid).emit('friendRequestAccepted', { friend: username });
            this.server.to(sid).emit('friendsList', senderFriends);
          }
        }
      }
    } catch (error) {
      client.emit('error', { message: error.message || 'Failed to respond to friend request.' });
    }
  }

  @SubscribeMessage('getFriendRequests')
  async handleGetFriendRequests(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;
      const requests = await this.chatService.getFriendRequests(username);
      client.emit('friendRequestsList', requests);
    } catch (error) {
      console.error('getFriendRequests error:', error);
    }
  }

  @SubscribeMessage('getFriends')
  async handleGetFriends(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) return;
      const friends = await this.chatService.getFriends(username);
      client.emit('friendsList', friends);
    } catch (error) {
      console.error('getFriends error:', error);
    }
  }

  @SubscribeMessage('removeFriend')
  async handleRemoveFriend(
    @MessageBody() data: Dto.RemoveFriendDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const username = client.data.user?.username;
      if (!username) {
        client.emit('error', { message: 'You must be logged in.' });
        return;
      }
      const removed = await this.chatService.removeFriend(username, data.friendUsername);
      if (removed) {
        client.emit('friendsList', await this.chatService.getFriends(username));
        client.emit('friendRemoved', { friendUsername: data.friendUsername });
        // Notify the other user
        const otherSocketIds = await this.chatService.getUserSocketIds(data.friendUsername);
        if (otherSocketIds.length > 0) {
          const otherFriends = await this.chatService.getFriends(data.friendUsername);
          for (const sid of otherSocketIds) {
            this.server.to(sid).emit('friendsList', otherFriends);
          }
        }
      } else {
        client.emit('error', { message: 'Could not remove friend.' });
      }
    } catch (error) {
      client.emit('error', { message: error.message || 'Failed to remove friend.' });
    }
  }

  @SubscribeMessage('getSiteUsers')
  async handleGetSiteUsers(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const users = await this.chatService.getAllRegisteredUsers();
      const mapped = users.map(u => ({
        name: u.username,
        username: u.username,
        displayName: u.displayName || u.username,
        avatar: u.avatar || null,
        gender: u.gender || 'other',
        country: u.country || 'Unknown',
        status: u.status || 'offline',
        globalRole: u.globalRole || 'user',
      }));
      client.emit('siteUsersList', mapped);
    } catch (error) {
      client.emit('error', { message: 'Failed to fetch site users' });
    }
  }
}

// Initialize security logger
SecurityLogger.initialize();

// Cleanup tasks
setInterval(() => {
  ContentModerator.clearOldHistory();
}, 5 * 60 * 1000); // Every 5 minutes
