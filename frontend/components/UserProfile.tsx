// frontend/components/UserProfile.tsx - ENHANCED WITH AVATAR UPLOAD
import { useState, useRef } from 'react';
import {
  User as UserIcon,
  Mail,
  MapPin,
  Edit,
  Camera,
  X,
  Check,
  Loader2,
  Upload,
  Globe,
  Shield,
  Crown,
  UserCheck,
  Calendar
} from 'lucide-react';
import { useDarkMode } from '../pages/_app';

interface User {
  username: string;
  email?: string;
  avatar?: string;
  displayName?: string;
  bio?: string;
  country?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  role?: 'owner' | 'admin' | 'moderator' | 'member';
  gender?: 'male' | 'female' | 'other';
  createdAt?: string;
  lastSeen?: string;
  age?: number;
}

interface Props {
  user: User;
  isOwnProfile: boolean;
  onUpdate?: (updates: Partial<User>) => void;
  onAvatarUpload?: (file: File) => Promise<string>;
  onStartDM?: (username: string) => void;
  onClose?: () => void;
}

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

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'online':
      return '🟢 Online';
    case 'away':
      return '🟡 Away';
    case 'busy':
      return '🔴 Busy';
    default:
      return '⚫ Offline';
  }
};

const getRoleIcon = (role?: string) => {
  switch (role) {
    case 'owner':
      return <Crown className="w-5 h-5 text-yellow-500" />;
    case 'admin':
      return <Shield className="w-5 h-5 text-red-500" />;
    case 'moderator':
      return <UserCheck className="w-5 h-5 text-blue-500" />;
    default:
      return <UserIcon className="w-5 h-5 text-gray-400" />;
  }
};

const getRoleLabel = (role?: string) => {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    default:
      return 'Member';
  }
};

const getCountryFlag = (countryName?: string): string => {
  const countryMap: Record<string, string> = {
    'usa': '🇺🇸', 'us': '🇺🇸', 'united states': '🇺🇸',
    'united kingdom': '🇬🇧', 'uk': '🇬🇧',
    'canada': '🇨🇦', 'india': '🇮🇳', 'australia': '🇦🇺',
    'germany': '🇩🇪', 'france': '🇫🇷', 'japan': '🇯🇵',
    'china': '🇨🇳', 'brazil': '🇧🇷', 'mexico': '🇲🇽',
    'spain': '🇪🇸', 'italy': '🇮🇹', 'russia': '🇷🇺',
    'south korea': '🇰🇷', 'singapore': '🇸🇬', 'uae': '🇦🇪',
    'saudi arabia': '🇸🇦', 'pakistan': '🇵🇰',
    'bangladesh': '🇧🇩', 'sri lanka': '🇱🇰',
  };

  if (!countryName) return '🌍';
  return countryMap[countryName.toLowerCase()] || '🌍';
};

export default function UserProfile({ user, isOwnProfile, onUpdate, onAvatarUpload, onStartDM, onClose }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user.bio || '');
  const [status, setStatus] = useState(user.status || 'online');
  const [displayName, setDisplayName] = useState((user as any).displayName || user.username);
  const [age, setAge] = useState<number | ''>(user.age || '');
  const [isUploading, setIsUploading] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { darkMode } = useDarkMode();

  const handleSave = () => {
    onUpdate?.({ bio, status, displayName, age: age !== '' ? Number(age) : undefined } as any);
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    if (isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewAvatar(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    if (onAvatarUpload) {
      setIsUploading(true);
      try {
        const avatarUrl = await onAvatarUpload(file);
        onUpdate?.({ avatar: avatarUrl });
        setPreviewAvatar(null);
      } catch (error) {
        console.error('Avatar upload failed:', error);
        alert('Failed to upload avatar');
        setPreviewAvatar(null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)'
      }}
    >
      {/* Cover/Header */}
      <div
        className="h-24 relative"
        style={{
          background: `linear-gradient(135deg, var(--accent-color), ${darkMode ? '#4c1d95' : '#7c3aed'})`
        }}
      >
        {/* Avatar */}
        <div className="absolute -bottom-12 left-6">
          <div
            className="relative w-24 h-24 rounded-full border-4 overflow-hidden cursor-pointer group"
            style={{ borderColor: 'var(--bg-primary)' }}
            onClick={handleAvatarClick}
          >
            {previewAvatar || user.avatar ? (
              <img
                src={previewAvatar || user.avatar}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <UserIcon className="w-12 h-12" style={{ color: 'var(--text-muted)' }} />
              </div>
            )}

            {isOwnProfile && (
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </div>
            )}

            {/* Status Indicator */}
            <div
              className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 ${getStatusColor(user.status)}`}
              style={{ borderColor: 'var(--bg-primary)' }}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Content */}
      <div className="pt-14 px-6 pb-6">
        {/* Name & Role */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h2
                className="text-2xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {user.username}
              </h2>
              {getRoleIcon(user.role)}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className="text-sm px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)'
                }}
              >
                {getRoleLabel(user.role)}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {getStatusLabel(user.status)}
              </span>
            </div>
          </div>

          {isOwnProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg transition-colors flex items-center space-x-1"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            >
              <Edit className="w-4 h-4" />
              <span className="text-sm">Edit</span>
            </button>
          )}
          {!isOwnProfile && onStartDM && (
            <button
              onClick={() => onStartDM(user.username)}
              className="px-4 py-2 rounded-lg transition-colors flex items-center space-x-1.5 text-sm font-medium"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'white'
              }}
            >
              <Mail className="w-4 h-4" />
              <span>Message</span>
            </button>
          )}
        </div>

        {/* Edit Form */}
        {isEditing ? (
          <div className="mt-4 space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
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
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="online">🟢 Online</option>
                <option value="away">🟡 Away</option>
                <option value="busy">🔴 Busy</option>
                <option value="offline">⚫ Offline</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                min={13}
                max={120}
                placeholder="Your age"
                className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'white'
                }}
              >
                <Check className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setBio(user.bio || '');
                  setStatus(user.status || 'online');
                  setAge(user.age || '');
                }}
                className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)'
                }}
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Bio */}
            <p style={{ color: 'var(--text-secondary)' }}>
              {user.bio || 'No bio yet'}
            </p>

            {/* Details */}
            <div className="space-y-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
              {user.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
                </div>
              )}

              {user.country && (
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {getCountryFlag(user.country)} {user.country}
                  </span>
                </div>
              )}

              {user.gender && (
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {user.gender === 'male' ? '♂️ Male' : user.gender === 'female' ? '♀️ Female' : '⚧ Other'}
                  </span>
                </div>
              )}

              {user.age && (
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {user.age} years old
                  </span>
                </div>
              )}

              {user.createdAt && (
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Joined {formatDate(user.createdAt)}
                  </span>
                </div>
              )}

              {user.lastSeen && user.status === 'offline' && (
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>🕐</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Last seen {formatDate(user.lastSeen)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}