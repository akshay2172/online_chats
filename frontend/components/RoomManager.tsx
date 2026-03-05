// frontend/components/RoomManager.tsx - ENHANCED WITH FULL ROOM MANAGEMENT
import { useState, useEffect } from 'react';
import {
  Lock,
  Globe,
  Plus,
  X,
  Users,
  Settings,
  Trash2,
  LogOut,
  UserPlus,
  Shield,
  Crown,
  UserCheck,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Link2,
  Eye,
  EyeOff,
  Ban,
  UserX,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useDarkMode } from '../pages/_app';

interface Room {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  type: 'public' | 'unlisted' | 'private' | 'direct';
  members: string[];
  moderators: string[];
  owner: string;
  memberCount: number;
  createdAt?: string;
  avatar?: string;
  password?: string;
}

interface RoomBan {
  _id: string;
  roomName: string;
  username: string;
  bannedBy: string;
  reason?: string;
  banType: 'temporary' | 'permanent';
  expiresAt?: string;
  createdAt: string;
}

interface Props {
  rooms: Room[];
  currentRoom?: string;
  currentUser?: string;
  userRole?: 'owner' | 'admin' | 'moderator' | 'member';
  onCreateRoom: (roomData: { name: string; description: string; isPrivate: boolean; type: 'public' | 'unlisted' | 'private'; password?: string }) => void;
  onJoinRoom: (roomId: string, password?: string) => void;
  onLeaveRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onUpdateRoom?: (roomId: string, updates: Partial<Room>) => void;
  onAddMember?: (roomId: string, username: string) => void;
  onRemoveMember?: (roomId: string, username: string) => void;
  onPromoteMember?: (roomId: string, username: string, role: 'moderator' | 'admin') => void;
  onSwitchRoom: (roomId: string) => void;
  onUnbanUser?: (room: string, username: string) => void;
  onGetRoomBans?: (room: string) => void;
  isGuest?: boolean;
  roomCountInfo?: { created: number; limit: number };
  roomBans?: RoomBan[];
}

export default function RoomManager({
  rooms,
  currentRoom,
  currentUser,
  userRole = 'member',
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onDeleteRoom,
  onUpdateRoom,
  onAddMember,
  onRemoveMember,
  onPromoteMember,
  onSwitchRoom,
  onUnbanUser,
  onGetRoomBans,
  isGuest = false,
  roomCountInfo,
  roomBans = [],
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showBanManager, setShowBanManager] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomType, setRoomType] = useState<'public' | 'unlisted' | 'private'>('public');
  const [roomPassword, setRoomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordPrompt, setPasswordPrompt] = useState<{ roomId: string; roomName: string } | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const { darkMode } = useDarkMode();

  const isLimitReached = roomCountInfo && roomCountInfo.created >= roomCountInfo.limit;

  const handleCreate = () => {
    if (!roomName.trim()) return;
    if (isLimitReached) return;
    onCreateRoom({
      name: roomName.trim(),
      description: roomDescription.trim(),
      isPrivate: roomType === 'private',
      type: roomType,
      password: roomType === 'private' ? roomPassword : undefined,
    });
    setShowCreate(false);
    setRoomName('');
    setRoomDescription('');
    setIsPrivate(false);
    setRoomType('public');
    setRoomPassword('');
  };

  const handlePasswordJoin = () => {
    if (passwordPrompt && joinPassword.trim()) {
      onJoinRoom(passwordPrompt.roomId, joinPassword.trim());
      setPasswordPrompt(null);
      setJoinPassword('');
    }
  };

  const canManageRoom = (room: Room) => {
    if (!currentUser) return false;
    if (room.owner === currentUser) return true;
    if (room.moderators?.includes(currentUser)) return true;
    return false;
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const publicRooms = filteredRooms.filter(r => r.type === 'public');
  const unlistedRooms = filteredRooms.filter(r => r.type === 'unlisted');
  const privateRooms = filteredRooms.filter(r => r.type === 'private');
  const myRooms = filteredRooms.filter(r => r.members?.includes(currentUser || ''));

  const getRoomTypeIcon = (type: string) => {
    switch (type) {
      case 'private': return <Lock className="w-4 h-4" style={{ opacity: 0.7 }} />;
      case 'unlisted': return <Link2 className="w-4 h-4" style={{ opacity: 0.7 }} />;
      default: return <Globe className="w-4 h-4" style={{ opacity: 0.7 }} />;
    }
  };

  const getRoomTypeBadge = (type: string) => {
    switch (type) {
      case 'unlisted': return '🔗 Unlisted';
      case 'private': return '🔒 Private';
      default: return null;
    }
  };

  const renderRoomCard = (room: Room, showJoin = false) => (
    <div
      key={room.id}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${currentRoom === room.id ? 'ring-2' : ''}`}
      style={{
        backgroundColor: currentRoom === room.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
        borderColor: currentRoom === room.id ? 'var(--accent-color)' : 'var(--border-color)',
        color: currentRoom === room.id ? 'white' : 'var(--text-primary)'
      }}
      onClick={() => onSwitchRoom(room.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getRoomTypeIcon(room.type)}
          <span className="font-medium">{room.name}</span>
          {room.type !== 'public' && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{
              backgroundColor: currentRoom === room.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
              fontSize: '0.65rem'
            }}>
              {room.type === 'unlisted' ? '🔗' : '🔒'}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {showJoin ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (room.type === 'private' && room.password) {
                  setPasswordPrompt({ roomId: room.id, roomName: room.name });
                } else {
                  onJoinRoom(room.id);
                }
              }}
              className="px-3 py-1 text-sm rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
            >
              Join
            </button>
          ) : (
            <>
              <span className="text-xs opacity-70">{room.memberCount || room.members?.length || 0}</span>
              <Users className="w-3 h-3 opacity-70" />
              {canManageRoom(room) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showBanManager === room.name) {
                      setShowBanManager(null);
                    } else {
                      setShowBanManager(room.name);
                      onGetRoomBans?.(room.name);
                    }
                  }}
                  className="p-1 rounded hover:opacity-80 transition-opacity"
                  title="Manage bans"
                >
                  <Shield className="w-3 h-3 opacity-70" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {room.description && (
        <p className="text-sm mt-1 opacity-70 line-clamp-1">{room.description}</p>
      )}

      {/* Ban Management Panel (inline) */}
      {showBanManager === room.name && canManageRoom(room) && (
        <div
          className="mt-2 pt-2 border-t space-y-2"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1">
              <Ban className="w-3 h-3" /> Banned Users
            </span>
            <button
              onClick={() => setShowBanManager(null)}
              className="p-0.5 rounded hover:opacity-80"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {roomBans.length === 0 ? (
            <p className="text-xs opacity-60">No active bans</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {roomBans.map((ban) => (
                <div
                  key={ban._id}
                  className="flex items-center justify-between text-xs p-1.5 rounded"
                  style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
                >
                  <div>
                    <span className="font-medium">{ban.username}</span>
                    {ban.reason && <span className="opacity-60 ml-1">— {ban.reason}</span>}
                    {ban.banType === 'temporary' && ban.expiresAt && (
                      <span className="ml-1 flex items-center gap-0.5 opacity-60 inline-flex">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(ban.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onUnbanUser?.(room.name, ban.username)}
                    className="px-2 py-0.5 rounded text-xs transition-colors"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
                  >
                    Unban
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRoomSection = (title: string, roomList: Room[], showJoin = false) => {
    if (roomList.length === 0) return null;
    const displayRooms = showJoin
      ? roomList.filter(r => !r.members?.includes(currentUser || ''))
      : roomList;
    if (displayRooms.length === 0) return null;

    return (
      <div>
        <h4
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          {title} — {displayRooms.length}
        </h4>
        <div className="space-y-2">
          {displayRooms.map(room => renderRoomCard(room, showJoin))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <div
        className="p-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
          <h3
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Rooms
          </h3>
        </div>
        {!isGuest && (
          <button
            onClick={() => setShowCreate(true)}
            disabled={!!isLimitReached}
            className="p-2 rounded-lg transition-colors flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isLimitReached ? 'var(--bg-tertiary)' : 'var(--accent-color)',
              color: 'white'
            }}
            title={isLimitReached ? `Room limit reached (${roomCountInfo?.created}/${roomCountInfo?.limit})` : 'Create a new room'}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Create</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-4">
        <div
          className="flex items-center space-x-2 px-3 py-2 rounded-lg border"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {renderRoomSection('My Rooms', myRooms)}
        {renderRoomSection('Public Rooms', publicRooms, true)}
        {renderRoomSection('Unlisted Rooms', unlistedRooms, true)}
        {renderRoomSection('Private Rooms', privateRooms, true)}

        {filteredRooms.length === 0 && (
          <div
            className="text-center py-8"
            style={{ color: 'var(--text-muted)' }}
          >
            <div className="text-4xl mb-2">🏠</div>
            <p className="text-sm">No rooms found</p>
            {!isGuest && <p className="text-xs mt-1">Create a new room to get started</p>}
            {isGuest && <p className="text-xs mt-1">Sign up to create your own rooms</p>}
          </div>
        )}
      </div>

      {/* Password Prompt Modal */}
      {passwordPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => { setPasswordPrompt(null); setJoinPassword(''); }}
        >
          <div
            className="rounded-xl shadow-xl p-6 max-w-sm w-full"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 mb-4">
              <Lock className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Room Password Required
              </h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Enter the password to join <strong>{passwordPrompt.roomName}</strong>
            </p>
            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordJoin()}
                placeholder="Enter password..."
                className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                autoFocus
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePasswordJoin}
                disabled={!joinPassword.trim()}
                className="flex-1 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
              >
                Join Room
              </button>
              <button
                onClick={() => { setPasswordPrompt(null); setJoinPassword(''); }}
                className="flex-1 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="rounded-xl shadow-xl p-6 max-w-md w-full"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                Create New Room
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 rounded transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Room Creation Limit Info */}
            {roomCountInfo && (
              <div
                className="flex items-center space-x-2 p-2 rounded-lg mb-4 text-sm"
                style={{
                  backgroundColor: isLimitReached ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                  color: isLimitReached ? '#ef4444' : 'var(--accent-color)',
                  border: `1px solid ${isLimitReached ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`
                }}
              >
                {isLimitReached ? (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                )}
                <span>
                  {isLimitReached
                    ? `You've exceeded your current plan limit (${roomCountInfo.created}/${roomCountInfo.limit} rooms). Existing rooms are kept.`
                    : `${roomCountInfo.created}/${roomCountInfo.limit} rooms created`
                  }
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Room Name *
                </label>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., General Chat"
                  className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Description
                </label>
                <textarea
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  placeholder="What's this room about?"
                  rows={2}
                  className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Room Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'unlisted', 'private'] as const).map((type) => {
                    const icons = { public: Globe, unlisted: Link2, private: Lock };
                    const labels = { public: 'Public', unlisted: 'Unlisted', private: 'Private' };
                    const descriptions = {
                      public: 'Anyone can find & join',
                      unlisted: 'Join via link only',
                      private: 'Password protected'
                    };
                    const Icon = icons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setRoomType(type);
                          setIsPrivate(type === 'private');
                          if (type !== 'private') setRoomPassword('');
                        }}
                        className={`p-3 rounded-lg border flex flex-col items-center space-y-1 transition-all ${roomType === type ? 'ring-2 ring-blue-500' : ''}`}
                        style={{
                          backgroundColor: roomType === type ? 'var(--accent-color)' : 'var(--bg-secondary)',
                          borderColor: roomType === type ? 'var(--accent-color)' : 'var(--border-color)',
                          color: roomType === type ? 'white' : 'var(--text-primary)'
                        }}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{labels[type]}</span>
                        <span className="text-xs opacity-70 text-center leading-tight">{descriptions[type]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Password field for private rooms */}
              {roomType === 'private' && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Room Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Set a password (optional for invite-only)"
                      className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-10"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {roomPassword ? 'Users will need this password to join' : 'Leave empty for invite-only access'}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={!roomName.trim() || !!isLimitReached}
                  className="flex-1 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white'
                  }}
                >
                  Create Room
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}