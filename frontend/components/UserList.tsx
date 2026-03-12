// frontend/components/UserList.tsx - ENHANCED WITH THEME & RESPONSIVENESS
import React, { useState } from 'react';
import { Users, X, ChevronLeft, MessageCircle, Shield, Crown, UserCheck } from 'lucide-react';
import { useDarkMode } from '../pages/_app';

interface User {
  name: string;
  displayName?: string;
  gender: 'male' | 'female' | 'other';
  country: string;
  isActive?: boolean;
  avatar?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  role?: 'owner' | 'admin' | 'moderator' | 'member';
  bio?: string;
}

interface Props {
  users: User[];
  currentUser?: string;
  onStartDM?: (username: string) => void;
  onViewProfile?: (username: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}

// Country code to flag emoji mapping
const countryToFlag = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Country name to flag (simplified for common countries)
const getCountryFlag = (countryName: string): string => {
  const countryMap: Record<string, string> = {
    'usa': '🇺🇸',
    'us': '🇺🇸',
    'united states': '🇺🇸',
    'united kingdom': '🇬🇧',
    'uk': '🇬🇧',
    'canada': '🇨🇦',
    'india': '🇮🇳',
    'australia': '🇦🇺',
    'germany': '🇩🇪',
    'france': '🇫🇷',
    'japan': '🇯🇵',
    'china': '🇨🇳',
    'brazil': '🇧🇷',
    'mexico': '🇲🇽',
    'spain': '🇪🇸',
    'italy': '🇮🇹',
    'russia': '🇷🇺',
    'south korea': '🇰🇷',
    'singapore': '🇸🇬',
    'uae': '🇦🇪',
    'saudi arabia': '🇸🇦',
    'pakistan': '🇵🇰',
    'bangladesh': '🇧🇩',
    'sri lanka': '🇱🇰',
  };

  const lowerName = countryName ? countryName.toLowerCase() : '';
  return countryMap[lowerName] || '🌍';
};

const getGenderSymbol = (gender: string): string => {
  if (!gender) return '⚧';
  switch (gender.toLowerCase()) {
    case 'male':
      return '♂️';
    case 'female':
      return '♀️';
    default:
      return '⚧';
  }
};

const getGenderColor = (gender: string): string => {
  if (!gender) return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700';
  switch (gender.toLowerCase()) {
    case 'male':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
    case 'female':
      return 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700';
    default:
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700';
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'away':
      return 'bg-yellow-500';
    case 'busy':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
};

const getRoleIcon = (role?: string) => {
  switch (role) {
    case 'owner':
      return <Crown className="w-3 h-3 text-yellow-500" />;
    case 'admin':
      return <Shield className="w-3 h-3 text-red-500" />;
    case 'moderator':
      return <UserCheck className="w-3 h-3 text-blue-500" />;
    default:
      return null;
  }
};

const getRoleLabel = (role?: string) => {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Mod';
    default:
      return '';
  }
};

const UserList: React.FC<Props> = ({
  users,
  currentUser,
  onStartDM,
  onViewProfile,
  isOpen: controlledIsOpen,
  onToggle,
  showToggle = true
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { darkMode } = useDarkMode();

  // Use controlled or uncontrolled state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));

  const onlineUsers = users.filter(u => u.status === 'online' || u.isActive);
  const awayUsers = users.filter(u => u.status === 'away');
  const busyUsers = users.filter(u => u.status === 'busy');
  const offlineUsers = users.filter(u => !u.status || u.status === 'offline');

  const renderUserItem = (user: User) => (
    <div
      key={user.name}
      className="p-3 rounded-lg border transition-all duration-200 hover:shadow-sm group cursor-pointer"
      style={{
        backgroundColor: user.name === currentUser ? 'var(--accent-color)' : 'var(--bg-primary)',
        borderColor: user.name === currentUser ? 'var(--accent-color)' : 'var(--border-color)',
        opacity: user.status === 'offline' ? 0.7 : 1
      }}
      onClick={() => {
        if (onViewProfile) {
          onViewProfile(user.name);
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* User Avatar with Gender */}
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${user.gender === 'female'
                  ? 'bg-gradient-to-r from-pink-100 to-pink-50 text-pink-600 dark:from-pink-900/50 dark:to-pink-800/50 dark:text-pink-300'
                  : user.gender === 'male'
                    ? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-600 dark:from-blue-900/50 dark:to-blue-800/50 dark:text-blue-300'
                    : 'bg-gradient-to-r from-purple-100 to-purple-50 text-purple-600 dark:from-purple-900/50 dark:to-purple-800/50 dark:text-purple-300'
                  }`}
              >
                {(user.displayName || user.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            {/* Status Dot */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 rounded-full ${getStatusColor(user.status)}`}
              style={{ borderColor: 'var(--bg-primary)' }}
            />
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span
                className={`font-medium truncate ${user.name === currentUser ? 'text-white' : ''}`}
                style={user.name !== currentUser ? { color: 'var(--text-primary)' } : {}}
              >
                {user.displayName || user.name || 'Unknown'}
              </span>
              {getRoleIcon(user.role)}
              {user.name === currentUser && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--accent-color)'
                  }}
                >
                  You
                </span>
              )}
            </div>

            {/* Country and Gender */}
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex items-center space-x-1">
                <span className="text-lg">{getCountryFlag(user.country)}</span>
                <span
                  className="text-xs"
                  style={{ color: user.name === currentUser ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}
                >
                  {user.country || 'Unknown'}
                </span>
              </div>
              <div
                className={`flex items-center space-x-1 text-xs px-1.5 py-0.5 rounded-full border ${getGenderColor(user.gender)}`}
              >
                <span className="text-xs">{getGenderSymbol(user.gender)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DM Button */}
        {onStartDM && user.name !== currentUser && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartDM(user.name);
            }}
            className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover-bg-secondary hover-text-accent"
            style={{
              color: 'var(--text-muted)',
            }}
            title={`Message ${user.displayName || user.name}`}
            aria-label={`Message ${user.displayName || user.name}`}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* User List Panel */}
      <div className="h-full">
        <div
          className="h-full border lg:rounded-xl shadow-lg overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)'
          }}
        >
          {/* Header */}
          <div
            className="p-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
              <h3
                className="text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                Active Users
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {onlineUsers.length}
                </span>
              </div>
              {/* Close button removed - controlled by parent toggle */}
            </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {users.length === 0 ? (
              <div
                className="text-center py-8"
                style={{ color: 'var(--text-muted)' }}
              >
                <div className="text-4xl mb-2">👤</div>
                <p className="text-sm">No users online yet</p>
              </div>
            ) : (
              <>
                {/* Online Users */}
                {onlineUsers.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Online — {onlineUsers.length}
                    </h4>
                    <div className="space-y-2">
                      {onlineUsers.map(renderUserItem)}
                    </div>
                  </div>
                )}

                {/* Away Users */}
                {awayUsers.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Away — {awayUsers.length}
                    </h4>
                    <div className="space-y-2">
                      {awayUsers.map(renderUserItem)}
                    </div>
                  </div>
                )}

                {/* Busy Users */}
                {busyUsers.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Busy — {busyUsers.length}
                    </h4>
                    <div className="space-y-2">
                      {busyUsers.map(renderUserItem)}
                    </div>
                  </div>
                )}

                {/* Offline Users */}
                {offlineUsers.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Offline — {offlineUsers.length}
                    </h4>
                    <div className="space-y-2">
                      {offlineUsers.map(renderUserItem)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Stats */}
          <div
            className="p-4 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <span className="text-blue-500">♂️</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {users.filter(u => u.gender && u.gender.toLowerCase() === 'male').length}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-pink-500">♀️</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {users.filter(u => u.gender && u.gender.toLowerCase() === 'female').length}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-purple-500">⚧</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {users.filter(u => !u.gender || u.gender.toLowerCase() === 'other').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="rounded-xl shadow-xl p-6 max-w-sm w-full"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                {selectedUser.avatar ? (
                  <img
                    src={selectedUser.avatar}
                    alt={selectedUser.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
                  >
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3
                    className="text-xl font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {selectedUser.displayName || selectedUser.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedUser.status)}`} />
                    <span
                      className="text-sm capitalize"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {selectedUser.status || 'offline'}
                    </span>
                    {selectedUser.role && selectedUser.role !== 'member' && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--accent-color)',
                          color: 'white'
                        }}
                      >
                        {getRoleLabel(selectedUser.role)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded transition-colors hover-bg-secondary"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getCountryFlag(selectedUser.country)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {selectedUser.country || 'Unknown location'}
                </span>
              </div>

              {selectedUser.bio && (
                <p style={{ color: 'var(--text-secondary)' }}>
                  {selectedUser.bio}
                </p>
              )}

              {onStartDM && selectedUser.name !== currentUser && (
                <button
                  onClick={() => {
                    onStartDM(selectedUser.name);
                    setSelectedUser(null);
                  }}
                  className="w-full py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white'
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Message</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserList;