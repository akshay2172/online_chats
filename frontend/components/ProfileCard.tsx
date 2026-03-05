import { useEffect, useState, useRef } from 'react';
import {
    User, Calendar, MapPin, Clock, Shield, Users as UsersIcon,
    MessageCircle, Globe, Cake, UserCheck, Activity, Edit, X, Check,
    Camera, Loader2, UserPlus
} from 'lucide-react';
import socket from '../utils/socket';

interface ProfileCardProps {
    username: string;
    isOwnProfile?: boolean;
    onStartDM?: (username: string) => void;
    onSendFriendRequest?: (username: string) => void;
    onUpdateProfile?: (updates: any) => void;
    onAvatarUpload?: (file: File) => Promise<string>;
    onClose?: () => void;
    fallbackData?: Partial<ProfileData>;
}

interface ProfileData {
    username: string;
    displayName: string;
    avatar?: string;
    bio: string;
    age?: number;
    country?: string;
    gender?: string;
    status: string;
    lastSeen?: string;
    globalRole: string;
    createdAt: string;
}

export default function ProfileCard({
    username, isOwnProfile, onStartDM, onSendFriendRequest, onUpdateProfile, onAvatarUpload, onClose, fallbackData
}: ProfileCardProps) {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [isEditing, setIsEditing] = useState(false);
    const [editBio, setEditBio] = useState('');
    const [editStatus, setEditStatus] = useState('');
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editAge, setEditAge] = useState<number | ''>('');
    const [isUploading, setIsUploading] = useState(false);
    const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch profile from backend
    useEffect(() => {
        setLoading(true);
        setProfile(null);
        socket.emit('getUserProfile', { username });

        const handleProfile = (data: ProfileData) => {
            setProfile(data);
            setLoading(false);
        };

        const handleError = (err: any) => {
            if (err.message && (err.message.includes('User not found') || err.message.includes('load profile'))) {
                setLoading(false);
            }
        };

        socket.on('userProfileData', handleProfile);
        socket.on('userProfileError', handleError);
        return () => {
            socket.off('userProfileData', handleProfile);
            socket.off('userProfileError', handleError);
        };
    }, [username]);

    // Build display profile from fetched data or fallback
    const displayProfile = profile || (fallbackData ? {
        username: username,
        displayName: fallbackData.displayName || username,
        avatar: fallbackData.avatar,
        bio: fallbackData.bio || '',
        age: fallbackData.age,
        country: fallbackData.country || 'Unknown',
        gender: fallbackData.gender || 'other',
        status: fallbackData.status || 'online',
        lastSeen: fallbackData.lastSeen,
        globalRole: fallbackData.globalRole || 'user',
        createdAt: fallbackData.createdAt || new Date().toISOString()
    } as ProfileData : null);

    // Initialize edit fields when displayProfile becomes available
    useEffect(() => {
        if (displayProfile && !isEditing) {
            setEditBio(displayProfile.bio || '');
            setEditStatus(displayProfile.status || 'online');
            setEditDisplayName(displayProfile.displayName || '');
            setEditAge(displayProfile.age || '');
        }
    }, [displayProfile?.username, displayProfile?.bio, displayProfile?.status, displayProfile?.displayName, displayProfile?.age, isEditing]);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!displayProfile) {
        return (
            <div className="text-center py-12">
                <User className="w-16 h-16 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                <p className="text-base" style={{ color: 'var(--text-muted)' }}>User not found</p>
            </div>
        );
    }

    // ─── Helpers ──────────────────────────────────────────────
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Unknown';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const formatLastSeen = (dateStr?: string) => {
        if (!dateStr) return 'Unknown';
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return formatDate(dateStr);
    };

    const statusColor: Record<string, string> = {
        online: '#22c55e', offline: '#9ca3af', away: '#eab308', busy: '#ef4444'
    };
    const sColor = statusColor[displayProfile.status] || '#9ca3af';

    const roleBadge: Record<string, { label: string; color: string }> = {
        admin: { label: 'Admin', color: '#ef4444' },
        global_mod: { label: 'Moderator', color: '#a855f7' },
        user: { label: 'Member', color: '#3b82f6' },
    };
    const badge = roleBadge[displayProfile.globalRole] || { label: displayProfile.globalRole, color: '#6b7280' };

    const genderLabel: Record<string, string> = { male: '♂ Male', female: '♀ Female', other: '⚧ Other' };
    const gDisplay = genderLabel[displayProfile.gender || 'other'] || displayProfile.gender || 'Not specified';

    // ─── Actions ──────────────────────────────────────────────
    const handleSave = () => {
        if (!onUpdateProfile) return;
        const updates = {
            bio: editBio,
            status: editStatus,
            displayName: editDisplayName,
            age: editAge !== '' ? Number(editAge) : null
        };
        onUpdateProfile(updates);
        setIsEditing(false);
        // Optimistic update
        setProfile(prev => prev ? { ...prev, ...updates, age: updates.age ?? prev.age } : prev);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onAvatarUpload) return;
        if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Image must be less than 5MB'); return; }

        const reader = new FileReader();
        reader.onload = (ev) => setPreviewAvatar(ev.target?.result as string);
        reader.readAsDataURL(file);

        setIsUploading(true);
        try {
            const avatarUrl = await onAvatarUpload(file);
            onUpdateProfile?.({ avatar: avatarUrl });
            setPreviewAvatar(null);
            setProfile(prev => prev ? { ...prev, avatar: avatarUrl } : prev);
        } catch {
            alert('Failed to upload avatar');
            setPreviewAvatar(null);
        } finally {
            setIsUploading(false);
        }
    };

    const avatarSrc = previewAvatar || displayProfile.avatar;

    // ─── RENDER ───────────────────────────────────────────────
    return (
        <div className="overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>

            {/* ── Cover Photo (gradient banner) ────────────────── */}
            <div
                className="relative h-28"
                style={{
                    background: `linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)`
                }}
            >
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)'
                }} />

                {/* Edit button on cover */}
                {isOwnProfile && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:scale-105"
                        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                    >
                        <Edit className="w-3.5 h-3.5" />
                        Edit Profile
                    </button>
                )}
            </div>

            {/* ── Avatar (overlapping cover) ────────────────────── */}
            <div className="relative px-5" style={{ marginTop: '-48px' }}>
                <div className="flex items-end gap-4">
                    <div className="relative flex-shrink-0">
                        <div
                            className={`relative w-24 h-24 rounded-full border-4 overflow-hidden shadow-xl ${isOwnProfile ? 'cursor-pointer group' : ''}`}
                            style={{ borderColor: 'var(--bg-primary)' }}
                            onClick={() => { if (isOwnProfile) fileInputRef.current?.click(); }}
                        >
                            {avatarSrc ? (
                                <img src={avatarSrc} alt={displayProfile.displayName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600">
                                    {displayProfile.displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {isOwnProfile && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                                    {isUploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Camera className="w-7 h-7 text-white" />}
                                </div>
                            )}
                        </div>
                        {/* Status dot */}
                        <span
                            className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px]"
                            style={{ backgroundColor: sColor, borderColor: 'var(--bg-primary)' }}
                        />
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </div>

                    {/* Name + Status beside avatar */}
                    <div className="pb-1 min-w-0">
                        <h3 className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                            {displayProfile.displayName}
                        </h3>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            @{displayProfile.username}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Status + Role Row ──────────────────────────────── */}
            <div className="flex items-center gap-2 px-5 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sColor + '18', color: sColor }}>
                    <Activity className="w-3 h-3" />
                    <span className="capitalize">{displayProfile.status}</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: badge.color + '18', color: badge.color }}>
                    <Shield className="w-3 h-3" />
                    {badge.label}
                </div>
            </div>

            {/* ── Action Buttons (below avatar, Facebook-style) ── */}
            <div className="px-5 mt-4">
                {isOwnProfile ? (
                    isEditing ? null : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                            <Edit className="w-4 h-4" />
                            Edit Profile
                        </button>
                    )
                ) : (
                    <div className="flex gap-2">
                        {onStartDM && (
                            <button
                                onClick={() => onStartDM(displayProfile.username)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                            >
                                <MessageCircle className="w-4 h-4" />
                                Message
                            </button>
                        )}
                        {onSendFriendRequest && (
                            <button
                                onClick={() => onSendFriendRequest(displayProfile.username)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                <UserPlus className="w-4 h-4" />
                                Add Friend
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Divider ────────────────────────────────────────── */}
            <div className="mx-5 my-4" style={{ borderTop: '1px solid var(--border-color)' }} />

            {/* ── Edit Form / Bio ─────────────────────────────────── */}
            <div className="px-5">
                {isEditing ? (
                    <div className="space-y-3 pb-4">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Edit Your Profile</p>

                        <EditField label="Display Name">
                            <input
                                type="text" value={editDisplayName}
                                onChange={e => setEditDisplayName(e.target.value)}
                                className="w-full p-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            />
                        </EditField>

                        <EditField label="Bio">
                            <textarea
                                value={editBio} onChange={e => setEditBio(e.target.value)}
                                rows={3} placeholder="Tell us about yourself..."
                                className="w-full p-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none transition-all"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            />
                        </EditField>

                        <EditField label="Status">
                            <select
                                value={editStatus} onChange={e => setEditStatus(e.target.value)}
                                className="w-full p-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            >
                                <option value="online">🟢 Online</option>
                                <option value="away">🟡 Away</option>
                                <option value="busy">🔴 Busy</option>
                                <option value="offline">⚫ Offline</option>
                            </select>
                        </EditField>

                        <EditField label="Age">
                            <input
                                type="number" value={editAge}
                                onChange={e => setEditAge(e.target.value === '' ? '' : Number(e.target.value))}
                                min={13} max={120} placeholder="Your age"
                                className="w-full p-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            />
                        </EditField>

                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={handleSave}
                                className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                            >
                                <Check className="w-4 h-4" /> Save Changes
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold transition-all hover:opacity-90"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                <X className="w-4 h-4" /> Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    displayProfile.bio ? (
                        <div className="pb-2">
                            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Bio</p>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                {displayProfile.bio}
                            </p>
                        </div>
                    ) : null
                )}
            </div>

            {/* ── Info Fields ──────────────────────────────────────── */}
            {!isEditing && (
                <div className="px-5 pb-5">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Details</p>
                    <div className="space-y-0.5">
                        <InfoRow icon={<User className="w-4 h-4" />} label="Username" value={`@${displayProfile.username}`} />
                        <InfoRow icon={<UserCheck className="w-4 h-4" />} label="Display Name" value={displayProfile.displayName} />
                        <InfoRow icon={<Shield className="w-4 h-4" />} label="Role" value={badge.label} />
                        <InfoRow icon={<Cake className="w-4 h-4" />} label="Age" value={displayProfile.age ? `${displayProfile.age} years` : 'Not set'} />
                        <InfoRow icon={<Globe className="w-4 h-4" />} label="Gender" value={gDisplay} />
                        <InfoRow icon={<MapPin className="w-4 h-4" />} label="Country" value={displayProfile.country || 'Not set'} />
                        <InfoRow icon={<Calendar className="w-4 h-4" />} label="Joined" value={formatDate(displayProfile.createdAt)} />
                        <InfoRow icon={<Clock className="w-4 h-4" />} label="Last Seen" value={displayProfile.status === 'online' ? 'Now' : formatLastSeen(displayProfile.lastSeen)} />
                        <InfoRow icon={<UsersIcon className="w-4 h-4" />} label="Friends" value="Coming soon" muted />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────
function EditField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {label}
            </label>
            {children}
        </div>
    );
}

function InfoRow({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
            <span className="text-xs font-medium uppercase tracking-wide flex-1" style={{ color: 'var(--text-muted)' }}>
                {label}
            </span>
            <span
                className={`text-sm font-medium truncate max-w-[170px] text-right ${muted ? 'italic' : ''}`}
                style={{ color: muted ? 'var(--text-muted)' : 'var(--text-primary)' }}
            >
                {value}
            </span>
        </div>
    );
}
