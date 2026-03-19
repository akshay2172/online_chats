// frontend/components/SidebarMenu.tsx
import { useState, useEffect } from 'react';
import {
    User, Users, Bell, MessageCircle, Home, Settings, FileText, Pin,
    HelpCircle, AlertTriangle, Shield, Info, LogOut, X, ChevronRight,
    ChevronLeft, Moon, Sun, Eye, Lock, Palette, Globe,
    UserPlus, Ban, Search, ExternalLink
} from 'lucide-react';
import { useDarkMode } from '../pages/_app';
import NotificationCenter from './NotificationCenter';
import DirectMessages from './DirectMessages';
import RoomManager from './RoomManager';
import ProfileCard from './ProfileCard';

// ─── Types ────────────────────────────────────────────────────
interface SidebarMenuProps {
    isOpen: boolean;
    onClose: () => void;
    // User info
    username: string;
    avatar?: string;
    displayName?: string;
    status?: string;
    bio?: string;
    age?: number;
    country?: string;
    gender?: string;
    isGuest: boolean;
    currentUserRole: string;
    currentUserGlobalRole?: string;
    // Notifications
    unreadCount?: number;
    // DM props
    dmConversations: any[];
    activeDMConversation: any;
    dmMessages: any[];
    dmUnreadTotal: number;
    onStartDM: (username: string) => void;
    onSendDMMessage: (conversationId: string, message: string, receiver: string) => void;
    onDeleteDM: (conversationId: string) => void;
    onMarkDMAsRead: (conversationId: string) => void;
    onLoadDMMessages: (conversationId: string) => void;
    onViewProfile: (username: string) => void;
    // Rooms props
    rooms: any[];
    currentRoom: string;
    roomCountInfo?: { created: number; limit: number };
    roomBans: any[];
    onCreateRoom: (data: any) => void;
    onJoinRoom: (roomId: string) => void;
    onLeaveRoom: (roomId: string) => void;
    onDeleteRoom: (roomId: string) => void;
    onSwitchRoom: (roomId: string) => void;
    onUnbanUser: (room: string, username: string) => void;
    onGetRoomBans: (room: string) => void;
    onUpdateProfile?: (updates: any) => void;
    onAvatarUpload?: (file: File) => Promise<string>;
    onCoverUpload?: (file: File) => Promise<string>;
    // Pinned & media
    pinnedMessages: any[];
    messages: any[];
    // Site users
    blockedUsers?: string[];
    allSiteUsers?: any[];
    onBlockUser?: (username: string) => void;
    onUnblockUser?: (username: string) => void;
    onReportProfile?: (username: string) => void;
    onInviteToRoom?: (username: string) => void;
    // Friends
    friends?: any[];
    friendRequests?: any[];
    onSendFriendRequest?: (targetUsername: string) => void;
    onRespondFriendRequest?: (requestId: string, action: 'accept' | 'reject') => void;
    onRemoveFriend?: (friendUsername: string) => void;
}

type PanelType =
    | null
    | 'profile'
    | 'viewUserProfile'
    | 'friends'
    | 'siteUsers'
    | 'notifications'
    | 'directMessages'
    | 'rooms'
    | 'settings'
    | 'mediaFiles'
    | 'pinnedMessages'
    | 'help'
    | 'report'
    | 'terms'
    | 'about';

type SiteUsersTab = 'all' | 'blocked';
type SettingsTab = 'account' | 'privacy' | 'notifications' | 'chat' | 'appearance' | 'language';

// ─── Component ────────────────────────────────────────────────
export default function SidebarMenu(props: SidebarMenuProps) {
    const [activePanel, setActivePanel] = useState<PanelType>(null);
    const [siteUsersTab, setSiteUsersTab] = useState<SiteUsersTab>('all');
    const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
    const [reportText, setReportText] = useState('');
    const [reportSubmitted, setReportSubmitted] = useState(false);
    const [siteUserSearch, setSiteUserSearch] = useState('');
    const [blockedUserSearch, setBlockedUserSearch] = useState('');
    const [viewingProfileUsername, setViewingProfileUsername] = useState<string>('');
    const [friendsTab, setFriendsTab] = useState<'list' | 'requests'>('list');
    const { darkMode, toggleDarkMode } = useDarkMode();

    const handleStartDM = (username: string) => {
        if (props.isGuest) return;
        props.onStartDM(username);
        window.dispatchEvent(new CustomEvent('openDMCard'));
    };

    // Listen for viewProfileInSidebar event from UserList / other components
    useEffect(() => {
        const handler = (e: CustomEvent) => {
            const username = e.detail;
            if (username) {
                setViewingProfileUsername(username);
                setActivePanel('viewUserProfile');
            }
        };
        const dmHandler = () => {
            setActivePanel('directMessages');
        };
        window.addEventListener('viewProfileInSidebar', handler as EventListener);
        window.addEventListener('openDMPanel', dmHandler);
        return () => {
            window.removeEventListener('viewProfileInSidebar', handler as EventListener);
            window.removeEventListener('openDMPanel', dmHandler);
        };
    }, []);

    if (!props.isOpen) return null;

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/';
    };

    // ─── Menu Items ────────────────────────────────────────
    const menuItems: Array<{
        icon: React.ReactNode;
        label: string;
        panel?: PanelType;
        badge?: number;
        action?: () => void;
        dividerAfter?: boolean;
        danger?: boolean;
        guestHidden?: boolean;
    }> = [
            { icon: <User className="w-5 h-5" />, label: 'Profile', panel: 'profile', guestHidden: true },
            { icon: <UserPlus className="w-5 h-5" />, label: 'Friends', panel: 'friends', guestHidden: true },
            { icon: <Users className="w-5 h-5" />, label: 'Site Users', panel: 'siteUsers' },
            { icon: <Bell className="w-5 h-5" />, label: 'Notifications', panel: 'notifications', badge: props.unreadCount },
            { icon: <MessageCircle className="w-5 h-5" />, label: 'Direct Messages', action: () => window.dispatchEvent(new CustomEvent('openDMCard')), badge: props.dmUnreadTotal, guestHidden: true },
            { icon: <Home className="w-5 h-5" />, label: 'Rooms', panel: 'rooms', dividerAfter: true },
            { icon: <Settings className="w-5 h-5" />, label: 'Settings', panel: 'settings' },
            { icon: <FileText className="w-5 h-5" />, label: 'Media & Files', panel: 'mediaFiles' },
            { icon: <Pin className="w-5 h-5" />, label: 'Pinned Messages', panel: 'pinnedMessages', badge: props.pinnedMessages.length || undefined, dividerAfter: true },
            { icon: <HelpCircle className="w-5 h-5" />, label: 'Help / FAQ', panel: 'help' },
            { icon: <AlertTriangle className="w-5 h-5" />, label: 'Report a Problem', panel: 'report' },
            { icon: <Shield className="w-5 h-5" />, label: 'Terms & Privacy Policy', panel: 'terms' },
            { icon: <Info className="w-5 h-5" />, label: 'About', panel: 'about', dividerAfter: true },
            { icon: <LogOut className="w-5 h-5" />, label: 'Logout', action: handleLogout, danger: true },
        ];

    const filteredMenuItems = menuItems.filter(item => !(item.guestHidden && props.isGuest));

    // ─── Panels ────────────────────────────────────────────────
    const renderPanel = () => {
        switch (activePanel) {
            case 'profile':
                return (
                    <ProfileCard
                        username={props.username}
                        isOwnProfile={true}
                        onUpdateProfile={props.onUpdateProfile}
                        onAvatarUpload={props.onAvatarUpload}
                        onCoverUpload={props.onCoverUpload}
                        fallbackData={{
                            displayName: props.displayName,
                            avatar: props.avatar,
                            bio: props.bio,
                            age: props.age,
                            country: props.country,
                            gender: props.gender,
                            status: props.status,
                            globalRole: props.currentUserGlobalRole || props.currentUserRole
                        }}
                    />
                );

            case 'viewUserProfile':
                const siteUser = props.allSiteUsers?.find(u => u.name === viewingProfileUsername || u.username === viewingProfileUsername);
                return (
                    <ProfileCard
                        username={viewingProfileUsername}
                        isOwnProfile={viewingProfileUsername === props.username}
                        onStartDM={!props.isGuest ? handleStartDM : undefined}
                        onSendFriendRequest={!props.isGuest ? props.onSendFriendRequest : undefined}
                        onBlockUser={!props.isGuest ? props.onBlockUser : undefined}
                        onUnblockUser={!props.isGuest ? props.onUnblockUser : undefined}
                        onReportProfile={!props.isGuest ? props.onReportProfile : undefined}
                        onInviteToRoom={!props.isGuest ? props.onInviteToRoom : undefined}
                        fallbackData={siteUser ? {
                            displayName: siteUser.displayName || siteUser.name || siteUser.username,
                            avatar: siteUser.avatar,
                            gender: siteUser.gender,
                            country: siteUser.country,
                            status: siteUser.status,
                            globalRole: siteUser.globalRole,
                            role: siteUser.role // room-specific role if available
                        } : undefined}
                    />
                );

            case 'friends':
                return renderFriendsPanel();

            case 'siteUsers':
                return renderSiteUsersPanel();

            case 'notifications':
                return <NotificationCenter username={props.username} inline={true} />;

            case 'directMessages':
                return (
                    <DirectMessages
                        currentUser={props.username}
                        conversations={props.dmConversations}
                        onStartDM={handleStartDM}
                        onSendDMMessage={props.onSendDMMessage}
                        onDeleteDM={props.onDeleteDM}
                        onMarkDMAsRead={props.onMarkDMAsRead}
                        onLoadDMMessages={props.onLoadDMMessages}
                        activeDMConversation={props.activeDMConversation}
                        dmMessages={props.dmMessages}
                        onViewProfile={props.onViewProfile}
                    />
                );

            case 'rooms':
                return (
                    <RoomManager
                        rooms={props.rooms}
                        currentRoom={props.currentRoom}
                        currentUser={props.username}
                        userRole={props.currentUserGlobalRole as any} // use global role for admin/global_mod checks
                        isGuest={props.isGuest}
                        roomCountInfo={props.roomCountInfo}
                        roomBans={props.roomBans}
                        onCreateRoom={props.onCreateRoom}
                        onJoinRoom={props.onJoinRoom}
                        onLeaveRoom={props.onLeaveRoom}
                        onDeleteRoom={props.onDeleteRoom}
                        onSwitchRoom={props.onSwitchRoom}
                        onUnbanUser={props.onUnbanUser}
                        onGetRoomBans={props.onGetRoomBans}
                    />
                );

            case 'settings':
                return renderSettingsPanel();

            case 'mediaFiles':
                return renderMediaFilesPanel();

            case 'pinnedMessages':
                return renderPinnedPanel();

            case 'help':
                return renderHelpPanel();

            case 'report':
                return renderReportPanel();

            case 'terms':
                return renderTermsPanel();

            case 'about':
                return renderAboutPanel();

            default:
                return null;
        }
    };

    // ─── Site Users Panel ──────────────────────────────────────
    const renderSiteUsersPanel = () => {
        const filteredAll = (props.allSiteUsers || []).filter((u: any) =>
            (u.name || u.username || '').toLowerCase().includes(siteUserSearch.toLowerCase())
        );
        const filteredBlocked = (props.blockedUsers || []).filter((username: string) =>
            username.toLowerCase().includes(blockedUserSearch.toLowerCase())
        );

        return (
            <div className="space-y-3">
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                    {(['all', 'blocked'] as SiteUsersTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setSiteUsersTab(tab); setSiteUserSearch(''); setBlockedUserSearch(''); }}
                            className="flex-1 py-2.5 text-sm font-medium transition-colors"
                            style={{
                                backgroundColor: siteUsersTab === tab ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                color: siteUsersTab === tab ? 'white' : 'var(--text-primary)'
                            }}
                        >
                            {tab === 'all' ? (
                                <span className="flex items-center justify-center gap-1.5"><Eye className="w-4 h-4" /> View All</span>
                            ) : (
                                <span className="flex items-center justify-center gap-1.5"><Ban className="w-4 h-4" /> Blocked</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        value={siteUsersTab === 'all' ? siteUserSearch : blockedUserSearch}
                        onChange={(e) => siteUsersTab === 'all' ? setSiteUserSearch(e.target.value) : setBlockedUserSearch(e.target.value)}
                        placeholder={siteUsersTab === 'all' ? 'Search users...' : 'Search blocked users...'}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                </div>

                {siteUsersTab === 'all' ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredAll.length > 0
                            ? filteredAll.map((u: any) => (
                                <div key={u.name || u.username} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:opacity-90 transition" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
                                    onClick={() => { setViewingProfileUsername(u.name || u.username); setActivePanel('viewUserProfile'); }}>
                                    <div className="flex items-center gap-3">
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.name || u.username} className="w-9 h-9 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}>
                                                {(u.name || u.username || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name || u.username}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                </div>
                            ))
                            : (
                                <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                                    {siteUserSearch ? 'No users found' : 'No users online in this room'}
                                </p>
                            )
                        }
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredBlocked.length > 0
                            ? filteredBlocked.map((username: string) => (
                                <div key={username} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{username}</span>
                                    </div>
                                    {props.onUnblockUser && (
                                        <button
                                            onClick={() => props.onUnblockUser!(username)}
                                            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                                        >
                                            Unblock
                                        </button>
                                    )}
                                </div>
                            ))
                            : (
                                <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                                    {blockedUserSearch ? 'No blocked users found' : 'No blocked users'}
                                </p>
                            )
                        }
                    </div>
                )}
            </div>
        );
    };

    // ─── Friends Panel ─────────────────────────────────────────
    const renderFriendsPanel = () => {
        const friendsList = props.friends || [];
        const requestsList = props.friendRequests || [];

        return (
            <div className="space-y-3">
                {/* Tabs */}
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                        onClick={() => setFriendsTab('list')}
                        className="flex-1 py-2.5 text-sm font-medium transition-colors"
                        style={{
                            backgroundColor: friendsTab === 'list' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                            color: friendsTab === 'list' ? 'white' : 'var(--text-primary)',
                        }}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <Users className="w-4 h-4" /> My Friends {friendsList.length > 0 && `(${friendsList.length})`}
                        </span>
                    </button>
                    <button
                        onClick={() => setFriendsTab('requests')}
                        className="flex-1 py-2.5 text-sm font-medium transition-colors relative"
                        style={{
                            backgroundColor: friendsTab === 'requests' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                            color: friendsTab === 'requests' ? 'white' : 'var(--text-primary)',
                        }}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <Bell className="w-4 h-4" /> Requests
                            {requestsList.length > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">{requestsList.length}</span>
                            )}
                        </span>
                    </button>
                </div>

                {friendsTab === 'list' ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {friendsList.length > 0 ? (
                            friendsList.map((friend: any) => (
                                <div key={friend.username} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                                    <div
                                        className="flex items-center gap-3 cursor-pointer"
                                        onClick={() => { setViewingProfileUsername(friend.username); setActivePanel('viewUserProfile'); }}
                                    >
                                        {friend.avatar ? (
                                            <img src={friend.avatar} alt={friend.username} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}>
                                                {friend.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                                                {friend.displayName || friend.username}
                                            </span>
                                            <span className="text-xs capitalize" style={{ color: friend.status === 'online' ? '#22c55e' : 'var(--text-muted)' }}>
                                                {friend.status || 'offline'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!props.isGuest && props.onStartDM && (
                                            <button
                                                onClick={() => handleStartDM(friend.username)}
                                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                                style={{ backgroundColor: 'var(--bg-secondary)' }}
                                                title="Send Message"
                                            >
                                                <MessageCircle className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                                            </button>
                                        )}
                                        {props.onRemoveFriend && (
                                            <button
                                                onClick={() => props.onRemoveFriend!(friend.username)}
                                                className="p-2 rounded-lg transition-colors hover:opacity-80 text-red-500"
                                                style={{ backgroundColor: 'var(--bg-secondary)' }}
                                                title="Remove Friend"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 opacity-50">
                                <UserPlus className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-base font-medium" style={{ color: 'var(--text-muted)' }}>No friends yet</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Click on a user and send a friend request!</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {requestsList.length > 0 ? (
                            requestsList.map((req: any) => (
                                <div key={req._id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                                    <div
                                        className="flex items-center gap-3 cursor-pointer"
                                        onClick={() => { setViewingProfileUsername(req.from); setActivePanel('viewUserProfile'); }}
                                    >
                                        {req.fromUser?.avatar ? (
                                            <img src={req.fromUser.avatar} alt={req.from} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}>
                                                {req.from.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                                                {req.fromUser?.displayName || req.from}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>wants to be friends</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {props.onRespondFriendRequest && (
                                            <>
                                                <button
                                                    onClick={() => props.onRespondFriendRequest!(req._id, 'accept')}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                                                    style={{ backgroundColor: '#22c55e' }}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => props.onRespondFriendRequest!(req._id, 'reject')}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                                                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                                                >
                                                    Decline
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 opacity-50">
                                <Bell className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-base font-medium" style={{ color: 'var(--text-muted)' }}>No pending requests</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ─── Settings Panel ─────────────────────────────────────────
    const settingsItems: Array<{ key: SettingsTab; icon: React.ReactNode; label: string }> = [
        { key: 'account', icon: <User className="w-5 h-5" />, label: 'Account Settings' },
        { key: 'privacy', icon: <Lock className="w-5 h-5" />, label: 'Privacy' },
        { key: 'notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
        { key: 'chat', icon: <MessageCircle className="w-5 h-5" />, label: 'Chat Settings' },
        { key: 'appearance', icon: <Palette className="w-5 h-5" />, label: 'Appearance' },
        { key: 'language', icon: <Globe className="w-5 h-5" />, label: 'Language' },
    ];

    const renderSettingsPanel = () => {
        if (!settingsTab) {
            return (
                <div className="space-y-1">
                    {settingsItems.map(item => (
                        <button
                            key={item.key}
                            onClick={() => setSettingsTab(item.key)}
                            className="w-full flex items-center justify-between p-3.5 rounded-lg transition-colors hover:opacity-90"
                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                        >
                            <div className="flex items-center gap-3">
                                <span style={{ color: 'var(--text-secondary)' }}>{item.icon}</span>
                                <span className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                            </div>
                            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        </button>
                    ))}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <button
                    onClick={() => setSettingsTab(null)}
                    className="flex items-center gap-2 text-base font-medium transition-colors"
                    style={{ color: 'var(--accent-color)' }}
                >
                    <ChevronLeft className="w-4 h-4" /> Back to Settings
                </button>

                {settingsTab === 'account' && (
                    <div className="space-y-3">
                        <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Account Settings</h4>
                        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                            Manage your account details from your Profile panel.
                        </p>
                        <button
                            onClick={() => { setActivePanel('profile'); setSettingsTab(null); }}
                            className="w-full py-2.5 rounded-lg text-base font-medium text-white transition-colors"
                            style={{ backgroundColor: 'var(--accent-color)' }}
                        >
                            Go to Profile
                        </button>
                    </div>
                )}

                {settingsTab === 'privacy' && (
                    <div className="space-y-3">
                        <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Privacy</h4>
                        <div className="space-y-2">
                            <SettingsToggle label="Allow direct messages from anyone" defaultChecked={true} storageKey="privacy_allowDMs" />
                            <SettingsToggle label="Show online status" defaultChecked={true} storageKey="privacy_showOnline" />
                            <SettingsToggle label="Show read receipts" defaultChecked={true} storageKey="privacy_readReceipts" />
                        </div>
                    </div>
                )}

                {settingsTab === 'notifications' && (
                    <div className="space-y-3">
                        <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Notification Preferences</h4>
                        <div className="space-y-2">
                            <SettingsToggle label="Message notifications" defaultChecked={true} storageKey="notif_messages" />
                            <SettingsToggle label="Mention notifications" defaultChecked={true} storageKey="notif_mentions" />
                            <SettingsToggle label="Sound enabled" defaultChecked={true} storageKey="notif_sound" />
                            <SettingsToggle label="DM notifications" defaultChecked={true} storageKey="notif_dm" />
                        </div>
                    </div>
                )}

                {settingsTab === 'chat' && (
                    <div className="space-y-3">
                        <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Chat Settings</h4>
                        <div className="space-y-2">
                            <SettingsToggle label="Show link previews" defaultChecked={true} storageKey="chat_linkPreviews" />
                            <SettingsToggle label="Show timestamps" defaultChecked={true} storageKey="chat_timestamps" />
                            <SettingsToggle label="Auto-play GIFs" defaultChecked={true} storageKey="chat_autoGifs" />
                            <SettingsToggle label="Compact mode" defaultChecked={false} storageKey="chat_compact" />
                        </div>
                    </div>
                )}

                {settingsTab === 'appearance' && (
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h4>
                        <div
                            className="flex items-center justify-between p-4 rounded-xl border"
                            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
                        >
                            <div className="flex items-center gap-3">
                                {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-yellow-500" />}
                                <div>
                                    <span className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                                        {darkMode ? 'Dark Mode' : 'Light Mode'}
                                    </span>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {darkMode ? 'Easy on the eyes' : 'Bright and clean'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleDarkMode}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${darkMode ? 'bg-indigo-500' : 'bg-gray-300'}`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${darkMode ? 'translate-x-8' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>
                    </div>
                )}

                {settingsTab === 'language' && (
                    <div className="space-y-3">
                        <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Language</h4>
                        <select
                            className="w-full p-3 rounded-lg border text-base"
                            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            defaultValue="en"
                        >
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="hi">हिन्दी</option>
                            <option value="ar">العربية</option>
                            <option value="zh">中文</option>
                            <option value="ja">日本語</option>
                        </select>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Language changes will apply to the UI. Chat messages will remain in their original language.</p>
                    </div>
                )}
            </div>
        );
    };

    // ─── Media & Files Panel ─────────────────────────────────────
    const renderMediaFilesPanel = () => {
        const mediaMessages = props.messages.filter(
            (m) => m.messageType === 'file' || m.messageType === 'image' || m.messageType === 'voice'
        );
        return (
            <div className="space-y-3">
                {mediaMessages.length > 0 ? (
                    mediaMessages.map((m, i) => (
                        <div key={m._id || i} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-color)' }} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {m.fileData?.originalName || m.fileData?.filename || 'Media file'}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Shared by {m.sender}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 opacity-50">
                        <FileText className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-base font-medium" style={{ color: 'var(--text-muted)' }}>No media or files shared yet</p>
                    </div>
                )}
            </div>
        );
    };

    // ─── Pinned Messages Panel ──────────────────────────────────
    const renderPinnedPanel = () => (
        <div className="space-y-3">
            {props.pinnedMessages.length > 0 ? (
                props.pinnedMessages.map((m, i) => (
                    <div key={m._id || i} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <div className="flex items-start gap-2">
                            <Pin className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-color)' }}>{m.sender}</p>
                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{m.message}</p>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-50">
                    <Pin className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-base font-medium" style={{ color: 'var(--text-muted)' }}>No pinned messages</p>
                </div>
            )}
        </div>
    );

    // ─── Help / FAQ Panel ───────────────────────────────────────
    const renderHelpPanel = () => {
        const faqs = [
            { q: 'How do I create a room?', a: 'Open the Rooms panel from the menu and click "Create Room". Choose a name and visibility (public or private).' },
            { q: 'How do I send a direct message?', a: 'Click on a user in the user list or go to Direct Messages from the menu.' },
            { q: 'How do I block someone?', a: 'Click on their profile and use the block option. You can manage blocked users from Site Users > Blocked.' },
            { q: 'How do I change my avatar?', a: 'Go to your Profile and click on your avatar image to upload a new one.' },
            { q: 'How do I use dark mode?', a: 'Go to Settings > Appearance and toggle the dark mode switch.' },
        ];
        return (
            <div className="space-y-3">
                {faqs.map((faq, i) => (
                    <details key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                        <summary className="p-3.5 cursor-pointer text-base font-medium select-none" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}>
                            {faq.q}
                        </summary>
                        <div className="p-3.5 text-sm" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)' }}>
                            {faq.a}
                        </div>
                    </details>
                ))}
            </div>
        );
    };

    // ─── Report a Problem Panel ─────────────────────────────────
    const renderReportPanel = () => (
        <div className="space-y-4">
            {reportSubmitted ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h4 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Thank you!</h4>
                    <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Your report has been submitted. We'll look into it.</p>
                </div>
            ) : (
                <>
                    <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                        Found a bug or issue? Let us know and we'll fix it as soon as possible.
                    </p>
                    <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Describe the problem..."
                        rows={5}
                        className="w-full p-3 rounded-lg border text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                    <button
                        onClick={() => { if (reportText.trim()) { setReportSubmitted(true); setReportText(''); } }}
                        disabled={!reportText.trim()}
                        className="w-full py-2.5 rounded-lg text-base font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                    >
                        Submit Report
                    </button>
                </>
            )}
        </div>
    );

    // ─── Terms & Privacy Policy ─────────────────────────────────
    const renderTermsPanel = () => (
        <div className="space-y-4 text-base" style={{ color: 'var(--text-secondary)' }}>
            <h4 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Terms of Service</h4>
            <p>By using Online Hangout, you agree to conduct yourself respectfully. Harassment, hate speech, and illegal content are strictly prohibited and may result in permanent bans.</p>
            <h4 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Privacy Policy</h4>
            <p>We collect minimal data necessary to provide the service. Your messages, profile information, and activity data are stored securely. We do not sell your personal information to third parties.</p>
            <p>Profile pictures and uploaded files are stored on our servers. You can delete your account and associated data at any time.</p>
            <h4 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Content Policy</h4>
            <p>Users are responsible for the content they share. Moderators may remove content that violates community guidelines. Repeated violations will result in account suspension.</p>
        </div>
    );

    // ─── About Panel ────────────────────────────────────────────
    const renderAboutPanel = () => (
        <div className="text-center space-y-4 py-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Online Hangout</h4>
                <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Version 1.0.0</p>
            </div>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                A real-time chat application built with Next.js and NestJS. Connect with people, join rooms, and have conversations.
            </p>
            <div className="pt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                © {new Date().getFullYear()} Online Hangout. All rights reserved.
            </div>
        </div>
    );

    // ─── Render ─────────────────────────────────────────────────
    const panelTitle = activePanel
        ? (activePanel === 'viewUserProfile' ? viewingProfileUsername + "'s Profile" : menuItems.find(m => m.panel === activePanel)?.label || '')
        : '';

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />

            {/* Drawer */}
            <div
                className="relative w-[420px] max-w-[90vw] h-full shadow-2xl flex flex-col"
                style={{ backgroundColor: 'var(--bg-primary)' }}
            >
                {/* Header */}
                <div
                    className="p-4 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
                >
                    {activePanel ? (
                        <button
                            onClick={() => { setActivePanel(null); setSettingsTab(null); }}
                            className="flex items-center gap-2 text-base font-semibold transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            aria-label="Go back"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            {panelTitle}
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            {props.avatar ? (
                                <img src={props.avatar} alt={props.username} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: 'var(--accent-color)' }} />
                            ) : (
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br from-blue-500 to-purple-600">
                                    {props.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                                    {props.displayName || props.username}
                                </p>
                                <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                                    {props.status || 'Online'}
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={props.onClose}
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activePanel ? (
                        renderPanel()
                    ) : (
                        <nav className="space-y-1">
                            {filteredMenuItems.map((item, i) => (
                                <div key={i}>
                                    <button
                                        onClick={() => {
                                            if (item.action) {
                                                item.action();
                                            } else if (item.panel) {
                                                setActivePanel(item.panel);
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-150 group ${item.danger ? 'hover:bg-red-500/10' : 'hover-bg-secondary'}`}
                                        style={{ backgroundColor: 'transparent' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="transition-colors"
                                                style={{ color: item.danger ? '#ef4444' : 'var(--text-secondary)' }}
                                            >
                                                {item.icon}
                                            </span>
                                            <span
                                                className="text-base font-medium"
                                                style={{ color: item.danger ? '#ef4444' : 'var(--text-primary)' }}
                                            >
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.badge && item.badge > 0 && (
                                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white min-w-[20px] text-center">
                                                    {item.badge > 99 ? '99+' : item.badge}
                                                </span>
                                            )}
                                            {item.panel && (
                                                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                                            )}
                                        </div>
                                    </button>
                                    {item.dividerAfter && (
                                        <div className="my-2 border-t" style={{ borderColor: 'var(--border-color)' }} />
                                    )}
                                </div>
                            ))}
                        </nav>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Reusable Settings Toggle ────────────────────────────────
function SettingsToggle({ label, defaultChecked, storageKey }: { label: string; defaultChecked: boolean; storageKey: string }) {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    const [checked, setChecked] = useState(stored !== null ? stored === 'true' : defaultChecked);

    const toggle = () => {
        const newVal = !checked;
        setChecked(newVal);
        localStorage.setItem(storageKey, String(newVal));
    };

    return (
        <div
            className="flex items-center justify-between p-3.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <button
                onClick={toggle}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
                <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${checked ? 'translate-x-8' : 'translate-x-1'}`}
                />
            </button>
        </div>
    );
}
