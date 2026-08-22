# 💬 Real-Time Chat Application

A production-ready, enterprise-grade real-time chat application built with modern technologies featuring direct messaging, group rooms, rich media sharing, and advanced security measures.

![Tech Stack](https://img.shields.io/badge/Backend-NestJS-red?style=for-the-badge&logo=nestjs)
![Frontend](https://img.shields.io/badge/Frontend-Next.js-black?style=for-the-badge&logo=next.js)
![Database](https://img.shields.io/badge/Database-MongoDB-green?style=for-the-badge&logo=mongodb)
![Real-time](https://img.shields.io/badge/Real--time-Socket.IO-blue?style=for-the-badge&logo=socket.io)

---

## 🚀 Features Overview

### Core Messaging
- **Direct Messages (DM)** - Private one-on-one conversations with read receipts and delivery status
- **Group Chat Rooms** - Create and manage multi-user chat rooms with invite system
- **Message Reactions** - React to messages with emojis (aggregated by type)
- **Threaded Replies** - Reply to specific messages with context preservation
- **Typing Indicators** - Real-time "user is typing..." notifications
- **Mentions System** - @mention users in rooms for targeted notifications
- **Message Editing & Deletion** - Edit or delete your messages with update timestamps

### Rich Media & Content
- **File Uploads** - Share images, documents, audio files (up to 10MB)
- **Image Optimization** - Automatic image compression with Sharp
- **Audio Messages** - Record and send voice messages with waveform visualization
- **Link Previews** - Auto-generate Open Graph previews for shared URLs
- **Sanitized Content** - XSS protection with DOMPurify and content moderation

### User Experience
- **Guest Mode** - Quick access without registration (limited features)
- **Full Authentication** - JWT-based auth with email verification via OTP
- **User Profiles** - Customizable profiles with avatar, bio, country, gender
- **Friend System** - Add/remove friends, manage friend requests
- **Direct Message Floating Card** - Quick-access DM panel
- **Search Functionality** - Find users, rooms, and messages
- **Notification Center** - Centralized notification management
- **Toast Notifications** - Real-time feedback for all actions

### Advanced Features
- **Room Invitations** - Generate invite links with expiration
- **Appeal System** - Submit appeals for banned/muted accounts
- **Connection Status** - Visual indicators for online/offline/reconnecting states
- **Multi-Server Support** - Redis adapter for horizontal scaling
- **IP Ban System** - Security feature to block malicious IPs
- **Rate Limiting** - Prevent spam with configurable rate limits

---

## 🏗️ Architecture

### Backend (NestJS)

```
backend/
├── src/
│   ├── auth/           # JWT authentication, Passport strategies
│   ├── chat/           # WebSocket gateway, message handling
│   ├── user/           # User management, profiles
│   ├── room/           # Room CRUD, membership management
│   ├── invite/         # Invite link generation & validation
│   ├── notification/   # Push notifications, in-app alerts
│   ├── upload/         # File uploads, image processing
│   ├── link-preview/   # OG tag scraping, preview generation
│   ├── appeal/         # Ban/mute appeal system
│   ├── redis/          # Redis connection, caching layer
│   ├── schemas/        # Mongoose schemas, data models
│   ├── utils/          # Sanitizers, validators, security tools
│   └── middleware/     # Socket auth, rate limiting, IP ban
```

**Key Technologies:**
- **NestJS 11.x** - Modular server framework with dependency injection
- **Socket.IO 4.8** - WebSocket server with fallback support
- **MongoDB + Mongoose 9.x** - NoSQL database with ODM
- **Redis 5.x** - Caching, pub/sub, Socket.IO adapter
- **Passport + JWT** - Secure authentication flow
- **Bcrypt** - Password hashing
- **Sharp** - Image optimization
- **Winston** - Structured logging with daily rotation
- **Helmet + CORS** - Security headers and origin control
- **Express Rate Limit** - API protection
- **Class Validator + Class Transformer** - DTO validation

### Frontend (Next.js)

```
frontend/
├── pages/
│   ├── index.tsx       # Landing page, auth flows
│   ├── room/[id].tsx   # Group chat interface
│   ├── invite/[id].tsx # Invite acceptance page
│   └── profile/[id].tsx# User profile view
├── components/
│   ├── ChatWindow.tsx        # Main chat interface
│   ├── MessageInput.tsx      # Text input with emoji picker
│   ├── DirectMessages.tsx    # DM list panel
│   ├── DMFloatingCard.tsx    # Collapsible DM widget
│   ├── RoomManager.tsx       # Room creation/joining UI
│   ├── InviteManager.tsx     # Invite link management
│   ├── NotificationCenter.tsx# Notification dropdown
│   ├── TypingIndicator.tsx   # Animated typing dots
│   ├── LinkPreview.tsx       # URL preview cards
│   ├── UserProfile.tsx       # Profile modal
│   ├── SearchPanel.tsx       # Global search
│   ├── SidebarMenu.tsx       # Navigation sidebar
│   └── UserToast.tsx         # Toast notification component
├── styles/             # Tailwind CSS, global styles
├── utils/              # Socket client, API helpers
└── types/              # TypeScript interfaces
```

**Key Technologies:**
- **Next.js 16.x** - React framework with SSR/SSG
- **React 19.x** - Latest React with hooks
- **TypeScript 5.9** - Type-safe development
- **Tailwind CSS 4.x** - Utility-first styling
- **Socket.IO Client** - Real-time bidirectional communication
- **Lucide React** - Modern icon library
- **Emoji Mart** - Emoji picker with custom data
- **React Dropzone** - Drag-and-drop file uploads
- **WaveSurfer.js** - Audio waveform visualization
- **Axios** - HTTP client for REST APIs
- **date-fns** - Lightweight date formatting

---

## 🔐 Security Implementation

### Authentication Flow
1. **Registration** - Email/password with country/gender metadata
2. **OTP Verification** - Email-based one-time password (300s expiry)
3. **JWT Tokens** - Access token (short-lived) stored in localStorage
4. **Socket Authentication** - Middleware validates JWT on WebSocket handshake
5. **Session Management** - Token refresh, logout invalidation

### Input Validation & Sanitization
```typescript
// Multi-layer sanitization pipeline
InputSanitizer.sanitizeText()     // XSS prevention
InputSanitizer.validateUsername() // Regex validation
ContentModerator.checkProfanity() // Content filtering
DOMPurify.sanitize()              // HTML sanitization
```

### Rate Limiting
- **Socket Messages**: 30 messages/minute per user
- **API Endpoints**: Configurable per-route limits
- **Login Attempts**: Progressive delays after failures

### Additional Security Measures
- **IP Ban List** - Persistent blacklist for malicious actors
- **CORS Configuration** - Strict origin whitelisting
- **Helmet Headers** - Security HTTP headers
- **MongoDB Sanitization** - Query selector injection prevention
- **File Type Validation** - MIME type checking before upload
- **Password Hashing** - Bcrypt with salt rounds

---

## 📡 WebSocket Events Reference

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `joinRoom` | `{ roomId }` | Join a group chat room |
| `leaveRoom` | `{ roomId }` | Leave a group chat room |
| `sendMessage` | `{ roomId?, content, type }` | Send message to room or DM |
| `sendDM` | `{ recipient, content }` | Send direct message |
| `typingStart` | `{ roomId? }` | Notify typing started |
| `typingStop` | `{ roomId? }` | Notify typing stopped |
| `addReaction` | `{ messageId, emoji }` | React to a message |
| `removeReaction` | `{ messageId, emoji }` | Remove reaction |
| `editMessage` | `{ messageId, newContent }` | Edit existing message |
| `deleteMessage` | `{ messageId }` | Delete a message |
| `requestFriends` | `{ username }` | Send friend request |
| `acceptFriend` | `{ requestId }` | Accept friend request |
| `rejectFriend` | `{ requestId }` | Reject friend request |
| `createRoom` | `{ name, description }` | Create new room |
| `inviteToRoom` | `{ roomId, username }` | Invite user to room |
| `generateInviteLink` | `{ roomId, expires }` | Generate invite code |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `messageReceived` | `Message` | New message in room/DM |
| `dmMessageReceived` | `DMMessage` | New direct message |
| `messageUpdated` | `{ messageId, content }` | Message edited |
| `messageDeleted` | `{ messageId }` | Message deleted |
| `reactionAdded` | `{ messageId, emoji, count }` | Reaction added |
| `reactionRemoved` | `{ messageId, emoji }` | Reaction removed |
| `userTyping` | `{ userId, username }` | User started typing |
| `userStoppedTyping` | `{ userId }` | User stopped typing |
| `userJoined` | `{ userId, username }` | User joined room |
| `userLeft` | `{ userId, username }` | User left room |
| `friendsList` | `Friend[]` | Updated friends list |
| `friendRequestReceived` | `FriendRequest` | New friend request |
| `inviteReceived` | `Invite` | Room invitation |
| `notification` | `Notification` | In-app notification |
| `connectionStatus` | `{ status }` | Online/offline/reconnecting |
| `error` | `{ message, code }` | Error response |

---

## 🗄️ Database Schema

### User Schema
```typescript
{
  username: string (unique, required),
  email: string (unique, required),
  password: string (hashed, required),
  displayName?: string,
  avatar?: string,
  bio?: string,
  country?: string,
  gender?: 'male' | 'female' | 'other',
  isVerified: boolean,
  isBanned: boolean,
  isMuted: boolean,
  banReason?: string,
  muteUntil?: Date,
  lastSeen: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Schema
```typescript
{
  sender: ObjectId (ref: User),
  room?: ObjectId (ref: Room),
  recipient?: ObjectId (ref: User), // For DMs
  content: string,
  type: 'text' | 'image' | 'file' | 'audio',
  attachments?: [{ url, filename, mimeType, size }],
  reactions: [{ emoji, count, users: [ObjectId] }],
  replyTo?: ObjectId (ref: Message),
  mentions: [ObjectId (ref: User)],
  isEdited: boolean,
  isDeleted: boolean,
  deliveredAt?: Date,
  readAt?: Date,
  createdAt: Date
}
```

### Room Schema
```typescript
{
  name: string,
  description?: string,
  creator: ObjectId (ref: User),
  members: [ObjectId (ref: User)],
  admins: [ObjectId (ref: User)],
  isPrivate: boolean,
  inviteCode?: string,
  inviteExpires?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Redis 7+ (for multi-server support)
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/chat_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h
ALLOWED_ORIGINS=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

# Start development server
npm run start:dev

# Production build
npm run build
npm run start
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
EOF

# Start development server
npm run dev

# Production build
npm run build
npm run start
```

---

## 🧪 Testing

### Running Tests

```bash
# Backend unit tests
cd backend
npm run test

# Backend E2E tests
npm run test:e2e

# Frontend tests (configure Jest)
cd frontend
npm run test
```

### Manual Testing Checklist
- [ ] User registration with email verification
- [ ] Login/logout functionality
- [ ] Guest mode access
- [ ] Sending messages in rooms
- [ ] Direct messaging between users
- [ ] Message reactions (add/remove)
- [ ] Message editing and deletion
- [ ] File upload (images, documents, audio)
- [ ] Link preview generation
- [ ] Typing indicators
- [ ] Friend requests (send/accept/reject)
- [ ] Room creation and invitation
- [ ] Notification delivery
- [ ] Connection status updates
- [ ] Rate limiting enforcement

---

## 📊 Performance Optimizations

### Backend Optimizations
- **Redis Caching** - Cache frequently accessed data (user profiles, room lists)
- **MongoDB Indexing** - Indexed fields: username, email, room members, message timestamps
- **Connection Pooling** - Efficient database connection reuse
- **Lazy Loading** - Load messages in chunks (pagination)
- **Binary Compression** - Compress large file uploads

### Frontend Optimizations
- **Code Splitting** - Next.js automatic route-based splitting
- **Image Optimization** - Next.js Image component with lazy loading
- **Virtual Scrolling** - Render only visible messages in chat
- **Debounced Search** - Reduce API calls during search
- **Memoization** - React.memo for expensive components
- **WebSocket Reconnection** - Exponential backoff strategy

---

## 🔧 Environment Variables

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/db_user` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for JWT signing | *(required)* |
| `JWT_EXPIRES_IN` | Token expiration time | `1h` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000` |
| `SMTP_HOST` | Email server host | *(required for OTP)* |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email account | *(required)* |
| `SMTP_PASS` | Email password/app password | *(required)* |
| `UPLOAD_DIR` | File upload directory | `./uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |
| `PORT` | Server port | `4000` |

### Frontend (.env.local)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:4000` |
| `NEXT_PUBLIC_SOCKET_URL` | WebSocket server URL | `http://localhost:4000` |

---

## 🐛 Known Issues & Solutions

### Issue: Reaction Duplicates on Fast Clicks
**Solution**: Implemented reaction merging logic that aggregates counts instead of creating duplicate entries.

### Issue: Context Menu Position Overflow
**Solution**: Dynamic positioning algorithm detects viewport boundaries and adjusts menu placement.

### Issue: Messages Lost on Refresh
**Solution**: Implemented persistent message storage with optimistic UI updates and re-fetch on reconnect.

### Issue: Large Text Breaking Layout
**Solution**: CSS `word-break: break-word` and container max-width constraints.

---

## 🚧 Future Enhancements

- [ ] **End-to-End Encryption** - Signal Protocol for message encryption
- [ ] **Video/Audio Calls** - WebRTC integration for real-time calls
- [ ] **Message Translation** - Auto-translate messages using AI APIs
- [ ] **Advanced Moderation** - AI-powered content moderation
- [ ] **Push Notifications** - Firebase Cloud Messaging for mobile
- [ ] **Mobile Apps** - React Native iOS/Android applications
- [ ] **Desktop Apps** - Electron wrapper for Windows/Mac/Linux
- [ ] **Analytics Dashboard** - Admin panel for usage metrics
- [ ] **Chatbots** - Integration with AI assistants
- [ ] **Themes** - Customizable dark/light/color themes
- [ ] **Message Scheduling** - Schedule messages for future delivery
- [ ] **Polls & Surveys** - Interactive message types

---

## 📝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style Guidelines
- Follow ESLint configuration (`.eslintrc.json`)
- Use TypeScript strict mode
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

---

## 👥 Support & Contact

For issues, questions, or contributions:
- 📧 Email: support@chatapp.dev
- 🐛 Bug Reports: GitHub Issues
- 💬 Community: Discord/Slack channel (coming soon)

---

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - The progressive Node.js framework
- [Next.js](https://nextjs.org/) - The React Framework
- [Socket.IO](https://socket.io/) - Real-time bidirectional communication
- [MongoDB](https://www.mongodb.com/) - The developer data platform
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework
- [Lucide Icons](https://lucide.dev/) - Beautiful icons library

---

**Built with ❤️ using modern web technologies**

*Last Updated: December 2025*
