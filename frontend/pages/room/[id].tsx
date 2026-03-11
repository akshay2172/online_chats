// frontend/pages/room/[id].tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import socket, { connectSocket, handleAuthExpiry } from '../../utils/socket';
import ChatWindow from '../../components/ChatWindow';
import MessageInput from '../../components/MessageInput';
import UserList from '../../components/UserList';
import UserToast from '../../components/UserToast';
import TypingIndicator from '../../components/TypingIndicator';
import SearchPanel from '../../components/SearchPanel';
import { Search, X, Users, Menu, MessageCircle, Filter } from 'lucide-react';

import SidebarMenu from '../../components/SidebarMenu';
import DMFloatingCard from '../../components/DMFloatingCard';
import { SearchMessage, SearchFilters } from '../../components/SearchPanel';

interface User {
    name: string;
    displayName?: string;
    gender: 'male' | 'female' | 'other';
    country: string;
    isActive?: boolean;
    avatar?: string;
    status?: 'online' | 'away' | 'busy' | 'offline';
    role?: 'owner' | 'admin' | 'moderator' | 'member';
    globalRole?: 'admin' | 'global_mod' | 'user';
    bio?: string;
}

interface Message {
    _id?: string;
    id?: string | number;
    sender: string;
    message: string;
    reactions?: Array<{ emoji: string; users: string[] }>;
    replyTo?: string | null;
    isReported?: boolean;
    isRead?: boolean;
    readBy?: string[];
    isEdited?: boolean;
    editedAt?: string;
    isPinned?: boolean;
    messageType?: 'text' | 'file' | 'image' | 'voice' | 'gif' | 'sticker';
    fileData?: any;
    gifData?: any;
    mentions?: string[];
}

export default function Room() {
    const router = useRouter();
    const { id } = router.query;
    const [activeUsername, setActiveUsername] = useState<string>('');
    const activeUsernameRef = useRef(activeUsername);

    const [messages, setMessages] = useState<Message[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchResults, setSearchResults] = useState<SearchMessage[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [unreadMessageId, setUnreadMessageId] = useState<string | null>(null);
    const [showUserList, setShowUserList] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGuest, setIsGuest] = useState(true);
    const [roomCountInfo, setRoomCountInfo] = useState<{ created: number; limit: number } | undefined>(undefined);
    const [roomBans, setRoomBans] = useState<any[]>([]);

    const [localQuery, setLocalQuery] = useState<{ username: string; gender: string; country: string; avatar?: string; bio?: string; displayName?: string; status?: string; age?: number } | null>(null);

    // DM State
    const [dmConversations, setDmConversations] = useState<any[]>([]);
    const [activeDMConversation, setActiveDMConversation] = useState<any>(null);
    const [dmMessages, setDmMessages] = useState<any[]>([]);

    const [inviteModalTargetUsername, setInviteModalTargetUsername] = useState<string | null>(null);
    const [dmUnreadTotal, setDmUnreadTotal] = useState(0);
    const [showDMCard, setShowDMCard] = useState(false);
    const [dmBlockedInfo, setDmBlockedInfo] = useState<{
        targetUsername: string;
        direction: 'blockedByTarget' | 'blockedByYou';
        message: string;
        targetUser?: { username: string; avatar?: string; displayName?: string; status?: string };
    } | null>(null);

    // Friends State
    const [friends, setFriends] = useState<any[]>([]);
    const [friendRequests, setFriendRequests] = useState<any[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<string[]>([]);


    const currentUserData = users.find(u => u.name === activeUsername);
    const currentUserRole = currentUserData?.role || 'member';

    // Keep ref updated to avoid stale closures in window event listeners
    useEffect(() => {
        activeUsernameRef.current = activeUsername;
    }, [activeUsername]);

    // Resolve username from query OR localStorage on mount, but wait for router
    useEffect(() => {
        if (!router.isReady) return;

        const qUsername = typeof router.query.username === 'string' ? router.query.username : '';
        const qGender = typeof router.query.gender === 'string' ? router.query.gender : '';
        const qCountry = typeof router.query.country === 'string' ? router.query.country : '';
        const qAvatar = typeof router.query.avatar === 'string' ? router.query.avatar : undefined;

        const resolvedUsername = qUsername || localStorage.getItem('username') || '';
        const resolvedGender = qGender || localStorage.getItem('gender') || 'other';
        const resolvedCountry = qCountry || localStorage.getItem('country') || 'Unknown';
        const resolvedAvatar = qAvatar || localStorage.getItem('avatar') || undefined;

        // Load avatar from localStorage if available
        const savedAvatar = localStorage.getItem('avatar');

        if (!resolvedUsername && !localStorage.getItem('accessToken')) {
            // No username and not logged in as guest -> redirect to home
            router.push('/');
            return;
        }

        const resolvedBio = localStorage.getItem('bio') || undefined;
        const resolvedDisplayName = localStorage.getItem('displayName') || undefined;
        const resolvedStatus = localStorage.getItem('status') || undefined;
        const resolvedAgeStr = localStorage.getItem('age');
        const resolvedAge = resolvedAgeStr ? Number(resolvedAgeStr) : undefined;

        setLocalQuery({
            username: resolvedUsername,
            gender: resolvedGender,
            country: resolvedCountry,
            avatar: resolvedAvatar,
            bio: resolvedBio,
            displayName: resolvedDisplayName,
            status: resolvedStatus,
            age: resolvedAge
        });

        if (!activeUsername && resolvedUsername) {
            setActiveUsername(resolvedUsername);
        }
    }, [router.isReady, router.query]);

    // Track if we've already sent a join request to prevent duplicates
    const hasJoinedRef = useRef(false);
    const searchTimeoutRef = useRef<any>(null);

    // Reset join tracking when room ID changes
    useEffect(() => {
        hasJoinedRef.current = false;
    }, [id]);

    // Detect if the user is a guest (no auth token)
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        setIsGuest(!token);
    }, []);

    const addToast = useCallback((text: string) => {
        const id = Date.now() + Math.random();
        setToasts((prev: any) => [...prev, { id, text }]);
    }, []);

    // Connect socket and set up event listeners
    useEffect(() => {
        if (!id || !localQuery?.username) return;

        if (!socket.connected) {
            connectSocket();
        }

        const onConnect = () => {
            setIsConnected(true);
            setIsInitializing(false);

            if (!hasJoinedRef.current) {
                // We join using localQuery.username. Server will confirm actual name.
                socket.emit('joinRoom', {
                    room: id,
                    username: localQuery.username,
                    gender: localQuery.gender,
                    country: localQuery.country,
                    avatar: localQuery.avatar
                });
                hasJoinedRef.current = true;
                socket.emit('getRooms');
                // Load DM conversations on connect
                if (localStorage.getItem('accessToken')) {
                    socket.emit('getDMConversations');
                    socket.emit('getBlockedUsers');
                }
            }

        };

        const onDisconnect = () => setIsConnected(false);
        const onConnectError = () => setIsConnected(false);
        const onReconnect = () => {
            setIsConnected(true);
            if (activeUsernameRef.current) {
                socket.emit('joinRoom', {
                    room: id,
                    username: activeUsernameRef.current,
                    gender: localQuery.gender,
                    country: localQuery.country,
                    avatar: localQuery.avatar
                });
                if (localStorage.getItem('accessToken')) {
                    socket.emit('getDMConversations');
                    socket.emit('getBlockedUsers');
                }
            }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.io.on('reconnect', onReconnect);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.io.off('reconnect', onReconnect);
        };
    }, [id, localQuery]);

    // Set up message and user event listeners
    useEffect(() => {
        if (!id) return;

        // ✅ NEW: Identity Synchronization
        const onRoomJoined = (data: { room: string, username: string }) => {
            setActiveUsername(data.username);
            // Update URL cleanly without reloading page
            router.replace({
                pathname: `/room/${id}`,
                query: { ...router.query, username: data.username }
            }, undefined, { shallow: true });
        };

        const onLoadMessages = (loadedMessages: Message[]) => {
            const currentU = activeUsernameRef.current;
            const firstUnread = loadedMessages.find(msg =>
                msg.sender !== currentU && !msg.readBy?.includes(currentU)
            );

            if (firstUnread) {
                setUnreadMessageId(firstUnread._id || firstUnread.id?.toString() || null);
                setTimeout(() => setUnreadMessageId(null), 5000);
            }

            setMessages(loadedMessages.map(msg => ({
                ...msg,
                isRead: msg.sender === currentU || msg.readBy?.includes(currentU),
            })));
        };

        const onReceiveMessage = (msg: Message) => {
            const currentU = activeUsernameRef.current;
            setMessages(prev => {
                const msgId = msg._id || msg.id;
                if (prev.some(m => (m._id || m.id) === msgId)) return prev;

                return [...prev, {
                    ...msg,
                    isRead: msg.sender === currentU || msg.readBy?.includes(currentU),
                }];
            });

            if (msg.sender !== currentU && msg._id) {
                setTimeout(() => {
                    socket.emit('markAsRead', { messageId: msg._id, username: currentU, room: id });
                }, 3000);
            }
        };

        const onUserEvent = ({ type, username: eventUsername }: { type: string; username: string }) => {
            if (type === 'join') addToast(`${eventUsername} joined`);
            else if (type === 'leave') addToast(`${eventUsername} left`);
        };

        socket.on('roomJoined', onRoomJoined);
        socket.on('loadMessages', onLoadMessages);
        socket.on('receiveMessage', onReceiveMessage);

        socket.on('loadPinnedMessages', setPinnedMessages);
        socket.on('unreadCount', setUnreadCount);

        socket.on('updateUsers', setUsers);
        socket.on('roomsList', setRooms);
        socket.on('searchResults', (results: any[]) => {
            // Map to the format expected by SearchPanel if necessary
            // The SearchPanel expects { _id, sender, message, createdAt }
            const mappedResults = results.map(msg => ({
                _id: msg._id || msg.id,
                sender: msg.sender,
                message: msg.message,
                createdAt: msg.createdAt || msg.timestamp || new Date().toISOString()
            }));
            setSearchResults(mappedResults as any);
            setIsSearching(false);
        });

        // ... (standard UI handlers) ...
        socket.on('messageEdited', (updated) => setMessages(prev => prev.map(m => m._id === updated._id ? { ...m, message: updated.message, isEdited: true, editedAt: updated.editedAt } : m)));
        socket.on('messagePinned', (pinned) => { setMessages(prev => prev.map(m => m._id === pinned._id ? { ...m, isPinned: true } : m)); setPinnedMessages(prev => prev.some(m => m._id === pinned._id) ? prev : [...prev, pinned]); });
        socket.on('messageReported', ({ messageId }) => setMessages(prev => prev.map(m => (m._id === messageId || m.id === messageId) ? { ...m, isReported: true } : m)));
        socket.on('messageDeleted', ({ messageId }) => setMessages(prev => prev.filter(m => m._id !== messageId && m.id !== messageId)));
        socket.on('messageReaction', (data) => setMessages(prev => prev.map(m => (m._id === data.messageId || m.id === data.messageId) ? { ...m, reactions: data.reactions } : m)));
        socket.on('messageRead', (data) => setMessages(prev => prev.map(m => (m._id === data.messageId || m.id === data.messageId) ? { ...m, readBy: data.readBy, isRead: data.readBy.includes(activeUsernameRef.current) } : m)));
        socket.on('roomMarkedAsRead', () => { setMessages(prev => prev.map(m => ({ ...m, isRead: true }))); setUnreadCount(0); });
        socket.on('messageUnpinned', (data: any) => { const mId = data.messageId || data._id; setMessages(prev => prev.map(m => (m._id === mId || m.id === mId) ? { ...m, isPinned: false } : m)); setPinnedMessages(prev => prev.filter(m => m._id !== mId && m.id !== mId)); });
        socket.on('mention', (data) => addToast(`${data.mentionedBy} mentioned you`));
        socket.on('userTyping', ({ username: tu, isTyping }) => { if (tu === activeUsernameRef.current) return; setTypingUsers(prev => isTyping ? (prev.includes(tu) ? prev : [...prev, tu]) : prev.filter(u => u !== tu)); });
        socket.on('error', ({ message }) => {
            addToast(message);
            setIsSearching(false);
        });

        // Room system events
        socket.on('roomCountInfo', setRoomCountInfo);
        socket.on('roomBans', (data: any) => setRoomBans(data.bans || []));
        socket.on('userUnbanned', ({ username: u, by: b }) => {
            addToast(`${u} was unbanned by ${b}`);
            socket.emit('getRoomBans', { room: id });
        });
        socket.on('userBanned', ({ username: u, by: b, reason, duration }) => {
            const msg = duration ? `${u} was banned for ${duration} min` : `${u} was banned`;
            addToast(reason ? `${msg} — ${reason}` : msg);
        });
        socket.on('platformBanned', ({ by: b, reason }) => {
            addToast(`You have been platform-banned by ${b}${reason ? ': ' + reason : ''}`);
        });

        socket.on('authDowngraded', async (data: any) => {
            console.warn('Auth downgraded:', data.reason);
            const refreshed = await handleAuthExpiry();
            if (refreshed) {
                // Token was refreshed successfully - socket reconnected with new token
                // Mark as no longer guest
                setIsGuest(false);

                // Token was refreshed, socket was reconnected by handleAuthExpiry.  
                // The onConnect handler will handle re-joining the room.  
                // Just reset the join flag so onConnect can do its job.  
                hasJoinedRef.current = false;
            } else {
                // Refresh failed - clear all auth data and mark as guest
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                setIsGuest(true);
                addToast(data.message || 'Your session has expired. Please log in again.');
            }
        });

        // DM events
        socket.on('dmConversationsList', (convos: any[]) => {
            setDmConversations(convos);
            const total = convos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
            setDmUnreadTotal(total);
        });
        socket.on('dmConversationStarted', (data: any) => {
            setActiveDMConversation(data.conversation);
            setDmMessages(data.messages || []);
            // Open Floating Card instead of Sidebar
            setShowDMCard(true);
            setDmBlockedInfo(null);
        });
        socket.on('dmBlocked', (data: any) => {
            setDmBlockedInfo({
                targetUsername: data.targetUsername,
                direction: data.direction,
                message: data.message,
                targetUser: data.targetUser,
            });
            setShowDMCard(true);
        });
        socket.on('receiveDMMessage', (msg: any) => {
            setDmMessages(prev => {
                if (prev.some(m => m._id === msg._id)) return prev;
                return [...prev, msg];
            });
            // Refresh conversation list
            socket.emit('getDMConversations');
        });
        socket.on('dmMessagesLoaded', (data: any) => {
            setDmMessages(data.messages || []);
        });
        socket.on('dmConversationUpdated', () => {
            socket.emit('getDMConversations');
        });
        socket.on('dmConversationDeleted', (data: any) => {
            setDmConversations(prev => prev.filter(c => c._id !== data.conversationId));
            if (activeDMConversation?._id === data.conversationId) {
                setActiveDMConversation(null);
                setDmMessages([]);
            }
        });
        socket.on('dmRead', (data: any) => {
            setDmConversations(prev => {
                const updated = prev.map(c =>
                    c._id === data.conversationId ? { ...c, unreadCount: 0 } : c
                );
                const newTotal = updated.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
                setDmUnreadTotal(newTotal);
                return updated;
            });
        });

        socket.on('dmMessageReaction', (data: any) => {
            setDmMessages(prev => prev.map(m =>
                m._id === data.messageId ? { ...m, reactions: data.reactions } : m
            ));
        });
        socket.on('dmMessageDeleted', (data: any) => {
            setDmMessages(prev => prev.filter(m => m._id !== data.messageId));
        });
        socket.on('dmMessageEdited', (data: any) => {
            setDmMessages(prev => prev.map(m =>
                m._id === data.message._id ? { ...m, ...data.message } : m
            ));
        });

        // Read/delivery status events
        socket.on('dmMessagesRead', (data: any) => {
            setDmMessages(prev => prev.map(m =>
                m.conversationId === data.conversationId && m.sender === activeUsernameRef.current && !m.readAt
                    ? { ...m, readAt: data.readAt }
                    : m
            ));
        });
        socket.on('dmMessageDelivered', (data: any) => {
            setDmMessages(prev => prev.map(m =>
                m._id === data.messageId ? { ...m, deliveredAt: data.deliveredAt } : m
            ));
        });

        // Friends events
        socket.on('friendsList', (list: any[]) => setFriends(list));
        socket.on('friendRequestsList', (list: any[]) => setFriendRequests(list));
        socket.on('friendRequestSent', () => addToast('Friend request sent!'));
        socket.on('friendRequestAccepted', (data: any) => addToast(`${data.friend} accepted your friend request!`));
        socket.on('friendRemoved', (data: any) => addToast(`${data.friendUsername} removed from friends.`));

        // Block events
        socket.on('userBlocked', (data: any) => {
            setBlockedUsers(prev => [...prev, data.username]);
        });
        socket.on('userUnblocked', (data: any) => {
            setBlockedUsers(prev => prev.filter(u => u !== data.username));
            setDmBlockedInfo(prev =>
                prev && prev.targetUsername === data.username ? null : prev
            );
        });
        socket.on('blockedUsersList', (data: any) => {
            setBlockedUsers(data.blockedUsers || []);
        });

        // Avatar update


        socket.on('avatarUpdated', (data: any) => {
            if (data.avatarUrl) {
                localStorage.setItem('avatar', data.avatarUrl);
                setLocalQuery(prev => prev ? { ...prev, avatar: data.avatarUrl } : prev);
            }
        });

        socket.on('profileUpdateSuccess', (updatedUser: any) => {
            if (updatedUser.bio !== undefined) localStorage.setItem('bio', updatedUser.bio);
            if (updatedUser.displayName !== undefined) localStorage.setItem('displayName', updatedUser.displayName);
            if (updatedUser.status !== undefined) localStorage.setItem('status', updatedUser.status);
            if (updatedUser.avatar !== undefined) localStorage.setItem('avatar', updatedUser.avatar);
            if (updatedUser.age !== undefined) localStorage.setItem('age', updatedUser.age.toString());

            setLocalQuery(prev => prev ? {
                ...prev,
                bio: updatedUser.bio,
                displayName: updatedUser.displayName,
                status: updatedUser.status,
                age: updatedUser.age,
                avatar: updatedUser.avatar || prev.avatar
            } : prev);

            addToast('Profile updated successfully');
        });

        const initTimer = setTimeout(() => setIsInitializing(false), 3000);

        return () => {
            socket.off('roomJoined', onRoomJoined);
            socket.off('loadMessages', onLoadMessages);
            socket.off('receiveMessage', onReceiveMessage);

            socket.off('loadPinnedMessages');
            socket.off('unreadCount');
            socket.off('updateUsers');
            socket.off('roomsList');
            socket.off('searchResults');
            socket.off('messageEdited');
            socket.off('messagePinned');
            socket.off('messageReported');
            socket.off('messageDeleted');
            socket.off('messageReaction');
            socket.off('authDowngraded');
            socket.off('messageRead');
            socket.off('roomMarkedAsRead');
            socket.off('messageUnpinned');
            socket.off('mention');
            socket.off('userTyping');
            socket.off('error');
            socket.off('roomCountInfo');
            socket.off('roomBans');
            socket.off('userUnbanned');
            socket.off('userBanned');
            socket.off('platformBanned');
            socket.off('dmConversationsList');
            socket.off('dmConversationStarted');
            socket.off('receiveDMMessage');
            socket.off('dmMessagesLoaded');
            socket.off('dmConversationUpdated');
            socket.off('dmConversationDeleted');
            socket.off('dmRead');
            socket.off('avatarUpdated');
            socket.off('userProfileData');
            socket.off('dmMessageReaction');
            socket.off('dmMessageDeleted');
            socket.off('dmMessageEdited');
            socket.off('dmBlocked');
            socket.off('userBlocked');
            socket.off('userUnblocked');
            socket.off('blockedUsersList');
            clearTimeout(initTimer);


        };
    }, [id]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (id && activeUsernameRef.current) {
                socket.emit('leaveRoom', { room: id, username: activeUsernameRef.current });
            }
        };

        const forceOpenSidebar = () => {
            setIsSidebarOpen(true);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('openDMPanel', forceOpenSidebar);
        window.addEventListener('viewProfileInSidebar', forceOpenSidebar);
        window.addEventListener('openDMCard', () => setShowDMCard(true));
        window.addEventListener('showToast', (e: any) => addToast(e.detail));

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('openDMPanel', forceOpenSidebar);
            window.removeEventListener('viewProfileInSidebar', forceOpenSidebar);
            window.removeEventListener('showToast', (e: any) => addToast(e.detail));
            if (id && activeUsernameRef.current) {
                socket.emit('leaveRoom', { room: id, username: activeUsernameRef.current });
            }
        };
    }, [id]);

    // Separate useEffect strictly for non-message toasts like joins/leaves to avoid multi-binding
    useEffect(() => {
        if (!id) return;

        const onUserEvent = ({ type, username: eventUsername }: { type: string; username: string }) => {
            if (eventUsername === activeUsernameRef.current) return; // don't toast ourselves
            if (type === 'join') addToast(`${eventUsername} joined`);
            else if (type === 'leave') addToast(`${eventUsername} left`);
        };

        socket.on('userEvent', onUserEvent);
        return () => {
            socket.off('userEvent', onUserEvent);
        };
    }, [id, addToast]);

    // Apply activeUsername to all action emitters safely
    const handleSend = useCallback((messageText: string, replyToId?: string | null, mentions?: string[]) => {
        if (!messageText.trim()) return;
        socket.emit('sendMessage', { room: id, message: messageText, username: activeUsername, replyTo: replyToId, mentions });
        setReplyingTo(null);
    }, [id, activeUsername]);

    const handleFileUpload = useCallback(async (file: File) => {
        try {
            const formData = new FormData(); formData.append('file', file);
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!response.ok) throw new Error('Upload failed');
            const { url, filename, originalName, mimetype, size } = await response.json();
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

            socket.emit('uploadFile', { room: id, username: activeUsername, fileData: { filename, originalName, mimetype, size, url: fullUrl } });
            addToast('File uploaded');
        } catch { addToast('Upload failed'); }
    }, [id, activeUsername]);

    const handleSendGif = useCallback((gifUrl: string, gifData: any) => {
        socket.emit('sendGif', { room: id, gifUrl, username: activeUsername, replyTo: replyingTo ? String(replyingTo._id || replyingTo.id) : null, gifData });
        setReplyingTo(null);
    }, [id, activeUsername, replyingTo]);

    const handleVoiceRecord = useCallback(async (audioBlob: Blob) => {
        try {
            const formData = new FormData(); formData.append('file', audioBlob, 'voice.webm');
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!response.ok) throw new Error('Upload failed');
            const { url, filename } = await response.json();
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

            socket.emit('uploadFile', { room: id, username: activeUsername, fileData: { filename, originalName: 'voice.webm', mimetype: 'audio/webm', size: audioBlob.size, url: fullUrl } });
            addToast('Voice sent');
        } catch { addToast('Voice failed'); }
    }, [id, activeUsername]);

    const handleReact = useCallback((messageId: string | number, emoji: string, action: 'add' | 'remove') => {
        socket.emit('reactMessage', { room: id, messageId, emoji, username: activeUsername, action });
    }, [id, activeUsername]);

    const handleSearchMessages = useCallback((query: string, filters: SearchFilters) => {
        setIsSearching(true);
        socket.emit('searchMessages', { room: id, query, filters });
    }, [id]);

    // DM Handlers
    const handleStartDM = useCallback((targetUsername: string) => {
        socket.emit('startDM', { targetUsername, username: activeUsername });
        // Open floating card instead of sidebar
        setShowDMCard(true);
    }, [activeUsername]);

    const handleSendDMMessage = useCallback((conversationId: string, message: string, receiver: string, messageType?: string, fileData?: any, replyTo?: string) => {
        socket.emit('sendDMMessage', { conversationId, message, receiver, username: activeUsername, messageType, fileData, replyTo });
    }, [activeUsername]);

    const handleDeleteDMConversation = useCallback((conversationId: string) => {
        socket.emit('deleteDMConversation', { conversationId });
    }, []);

    const handleReactDM = useCallback((conversationId: string, messageId: string, emoji: string, action: 'add' | 'remove') => {
        socket.emit('reactDMMessage', { conversationId, messageId, emoji, action });
    }, []);

    const handleDeleteDMMessage = useCallback((conversationId: string, messageId: string) => {
        socket.emit('deleteDMMessage', { conversationId, messageId });
    }, []);

    const handleEditDMMessage = useCallback((conversationId: string, messageId: string, newMessage: string) => {
        socket.emit('editDMMessage', { conversationId, messageId, newMessage });
    }, []);

    const handleSendDMGif = useCallback((conversationId: string, receiver: string, gifUrl: string, gifData: any) => {
        socket.emit('sendDMGif', { conversationId, receiver, gifUrl, gifData });
    }, []);

    const handleDMFileUpload = useCallback(async (conversationId: string, receiver: string, file: File) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!response.ok) throw new Error('Upload failed');
            const { url, filename, originalName, mimetype, size } = await response.json();
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
            socket.emit('uploadDMFile', { conversationId, receiver, fileData: { filename, originalName, mimetype, size, url: fullUrl } });
        } catch { addToast('Upload failed'); }
    }, []);

    // Friends Handlers
    const handleSendFriendRequest = useCallback((targetUsername: string) => {
        socket.emit('sendFriendRequest', { targetUsername });
    }, []);

    const handleRespondFriendRequest = useCallback((requestId: string, action: 'accept' | 'reject') => {
        socket.emit('respondFriendRequest', { requestId, action });
    }, []);

    const handleRemoveFriend = useCallback((friendUsername: string) => {
        socket.emit('removeFriend', { friendUsername });
    }, []);

    const handleBlockUser = useCallback((username: string) => {
        socket.emit('blockUser', { usernameToBlock: username });
        addToast(`Blocked ${username}. They will no longer be able to message you.`);
    }, []);

    const handleUnblockUser = useCallback((username: string) => {
        socket.emit('unblockUser', { usernameToUnblock: username });
        addToast(`Unblocked ${username}.`);
    }, []);

    const handleReportUser = useCallback((username: string) => {
        socket.emit('reportUser', { usernameToReport: username, reason: 'Inappropriate behavior' });
        addToast(`Reported ${username} to moderators.`);
    }, []);

    const handleInviteToRoom = useCallback((targetUsername: string) => {
        setInviteModalTargetUsername(targetUsername);
    }, []);

    const confirmInviteToRoom = useCallback((roomId: string) => {
        if (inviteModalTargetUsername) {
            socket.emit('inviteUserToRoom', { targetUsername: inviteModalTargetUsername, roomId });
            addToast(`Invite sent to ${inviteModalTargetUsername}`);
            setInviteModalTargetUsername(null);
        }
    }, [inviteModalTargetUsername]);

    const handleMarkDMAsRead = useCallback((conversationId: string) => {
        socket.emit('markDMAsRead', { conversationId });
    }, []);

    const handleLoadDMMessages = useCallback((conversationId: string) => {
        socket.emit('loadDMMessages', { conversationId });
    }, []);

    const handleViewProfile = useCallback((username: string) => {
        setIsSidebarOpen(true);
        // We pass this via a ref-like mechanism to SidebarMenu
        (window as any).__viewProfileUsername = username;
        window.dispatchEvent(new CustomEvent('viewProfileInSidebar', { detail: username }));
    }, []);

    const handleAvatarUpload = useCallback(async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target?.result as string;
                socket.emit('uploadAvatar', { imageData, filename: file.name });

                // Listen for response
                const onAvatarUpdated = (data: any) => {
                    socket.off('avatarUpdated', onAvatarUpdated);
                    resolve(data.avatarUrl);
                };
                socket.on('avatarUpdated', onAvatarUpdated);

                // Timeout
                setTimeout(() => {
                    socket.off('avatarUpdated', onAvatarUpdated);
                    reject(new Error('Avatar upload timeout'));
                }, 10000);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }, []);

    const handleCoverUpload = useCallback(async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target?.result as string;
                socket.emit('uploadCoverPhoto', { imageData, filename: file.name });

                const onCoverUpdated = (data: any) => {
                    socket.off('coverPhotoUpdated', onCoverUpdated);
                    resolve(data.coverUrl);
                };
                socket.on('coverPhotoUpdated', onCoverUpdated);

                setTimeout(() => {
                    socket.off('coverPhotoUpdated', onCoverUpdated);
                    reject(new Error('Cover upload timeout'));
                }, 10000);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }, []);

    if (!id || !activeUsername) return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900"><p className="text-gray-600 dark:text-gray-400">Loading...</p></div>;

    return (
        <>
            <div className="fixed top-5 right-5 space-y-3 z-50">
                {toasts.map((toast: any) => (
                    <UserToast
                        key={toast.id}
                        text={toast.text}
                        onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    />
                ))}
            </div>

            {/* Sidebar Menu */}
            <SidebarMenu
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                username={activeUsername}
                avatar={localQuery?.avatar}
                displayName={localQuery?.displayName}
                status={localQuery?.status}
                bio={localQuery?.bio}
                age={localQuery?.age}
                country={localQuery?.country}
                gender={localQuery?.gender}
                isGuest={isGuest}
                currentUserRole={currentUserRole}
                unreadCount={unreadCount}
                dmConversations={dmConversations}
                activeDMConversation={activeDMConversation}
                dmMessages={dmMessages}
                dmUnreadTotal={dmUnreadTotal}
                onStartDM={handleStartDM}
                onSendDMMessage={handleSendDMMessage}
                onDeleteDM={handleDeleteDMConversation}
                onMarkDMAsRead={handleMarkDMAsRead}
                onLoadDMMessages={handleLoadDMMessages}
                onViewProfile={handleViewProfile}
                rooms={rooms}
                currentRoom={id as string}
                roomCountInfo={roomCountInfo}
                roomBans={roomBans}
                onCreateRoom={(data) => socket.emit('createRoom', { ...data, createdBy: activeUsername })}
                onJoinRoom={(roomId) => socket.emit('joinRoomById', { roomId, username: activeUsername, gender: localQuery?.gender || 'other', country: localQuery?.country || 'Unknown' })}
                onLeaveRoom={(roomId) => socket.emit('leaveRoom', { room: roomId, username: activeUsername })}
                onDeleteRoom={(roomId) => socket.emit('deleteRoom', { roomId, username: activeUsername })}
                onSwitchRoom={(roomId) => router.push(`/room/${roomId}?username=${activeUsername}&gender=${localQuery?.gender || 'other'}&country=${localQuery?.country || 'Unknown'}`)}
                onUnbanUser={(room, username) => socket.emit('unbanUser', { room, username })}
                onGetRoomBans={(room) => socket.emit('getRoomBans', { room })}
                onUpdateProfile={(updates) => socket.emit('updateProfile', { username: activeUsername, updates })}
                onAvatarUpload={handleAvatarUpload}
                onCoverUpload={handleCoverUpload}
                pinnedMessages={pinnedMessages}
                messages={messages}
                allSiteUsers={users}
                friends={friends}
                friendRequests={friendRequests}
                onSendFriendRequest={handleSendFriendRequest}
                onRespondFriendRequest={handleRespondFriendRequest}
                onRemoveFriend={handleRemoveFriend}
                onBlockUser={handleBlockUser}
                onUnblockUser={handleUnblockUser}
                onReportProfile={handleReportUser}
                onInviteToRoom={handleInviteToRoom}
                blockedUsers={blockedUsers}
            />


            <div className="flex gap-4 p-5 h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex flex-col min-w-0 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 relative" style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}>

                    {/* Header */}
                    <div className="px-6 py-4 z-10 border-b flex flex-col gap-2" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                                <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-lg relative transition-colors mr-2 group shrink-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                    <Menu className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
                                    {unreadCount > 0 && <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center transform scale-90 translate-x-1 -translate-y-1">{unreadCount}</span>}
                                </button>
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold shrink-0 shadow-sm">
                                    {typeof id === 'string' ? id.charAt(0).toUpperCase() : 'R'}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold truncate capitalize" style={{ color: 'var(--text-primary)' }}>{id}</h2>
                                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{messages.length} messages</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Search Component */}
                                <div className="relative group hidden sm:block">
                                    <div className="relative flex items-center">
                                        <input
                                            type="text"
                                            placeholder="Search messages..."
                                            className="w-48 md:w-64 pl-9 pr-4 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                            value={searchQuery}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSearchQuery(val);
                                                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                                                if (val.length > 2) {
                                                    searchTimeoutRef.current = setTimeout(() => {
                                                        handleSearchMessages(val, {});
                                                    }, 300);
                                                } else {
                                                    setSearchResults([]);
                                                    setIsSearching(false);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                                                    handleSearchMessages(searchQuery, {});
                                                }
                                            }}
                                        />
                                        <Search className="w-4 h-4 absolute left-3" style={{ color: 'var(--text-muted)' }} />

                                        {/* Dropdown Results */}
                                        {searchQuery && (
                                            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                                                {isSearching ? (
                                                    <div className="p-8 text-center flex flex-col items-center gap-3">
                                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Searching Archive...</span>
                                                    </div>
                                                ) : searchResults.length > 0 ? (
                                                    <div className="max-h-[400px] overflow-y-auto py-2 custom-scrollbar">
                                                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{searchResults.length} Results</div>
                                                        {searchResults.map((msg: any) => (
                                                            <div
                                                                key={msg._id}
                                                                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer border-b last:border-0 transition-colors group/result"
                                                                style={{ borderColor: 'var(--border-color)' }}
                                                                onClick={() => {
                                                                    window.dispatchEvent(new CustomEvent('jumpToMessage', { detail: msg._id }));
                                                                    setSearchQuery('');
                                                                    setSearchResults([]);
                                                                }}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs font-bold text-blue-500 truncate">{msg.sender}</span>
                                                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                                                        {new Date(msg.createdAt).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{msg.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-10 text-center flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center">
                                                            <Search className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No messages found</p>
                                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Try a different keyword</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowSearch(!showSearch)}
                                    className={`p-2 rounded-xl transition-all shadow-sm ${showSearch ? 'bg-blue-500 text-white shadow-blue-500/20' : 'hover:opacity-80'}`}
                                    style={{ backgroundColor: !showSearch ? 'var(--bg-secondary)' : undefined, color: !showSearch ? 'var(--text-secondary)' : undefined }}
                                >
                                    <Filter className="w-5 h-5" />
                                </button>

                                <div className="text-sm border-l pl-4 hidden lg:block" style={{ borderColor: 'var(--border-color)' }}>
                                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{localQuery?.displayName || activeUsername}</span>
                                </div>

                                <button onClick={() => setShowUserList(!showUserList)} className={`p-2 rounded-xl transition-all relative shadow-sm ${showUserList ? 'bg-blue-500 text-white shadow-blue-500/20 hover:bg-blue-600' : 'hover:opacity-80'}`} style={{ backgroundColor: !showUserList ? 'var(--bg-secondary)' : undefined, color: !showUserList ? 'var(--text-secondary)' : undefined }}>
                                    <Users className="w-5 h-5" />
                                    {users.length > 0 && <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-lg px-1.5 py-0.5 border-2 ${showUserList ? 'bg-white text-blue-500 border-blue-500' : 'bg-blue-500 text-white border-white dark:border-gray-800'}`}>{users.length}</span>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <ChatWindow
                        roomName={id as string}
                        messages={messages}
                        onReact={handleReact}
                        currentUser={activeUsername}
                        currentUserRole={currentUserRole as any}
                        currentUserGlobalRole={currentUserData?.globalRole}
                        onDeleteMessage={(messageId) => socket.emit('deleteMessage', { room: id, messageId })}
                        onReportMessage={(msgId) => socket.emit('reportMessage', { room: id, messageId: msgId, reportedBy: activeUsername })}
                        onReplyToMessage={setReplyingTo}
                        onEditMessage={(msgId, text) => socket.emit('editMessage', { messageId: msgId, newMessage: text, room: id })}
                        onPinMessage={(msgId) => socket.emit('pinMessage', { room: id, messageId: msgId })}
                        onUnpinMessage={(msgId) => socket.emit('unpinMessage', { room: id, messageId: msgId })}
                        onKickUser={(u) => socket.emit('kickUser', { room: id, username: u, by: activeUsername })}
                        onBanUser={(u) => socket.emit('banUser', { room: id, username: u, by: activeUsername })}
                        onPlatformBanUser={(u) => socket.emit('platformBan', { username: u })}
                        onPromoteUser={(u, role) => socket.emit('promoteUser', { room: id, username: u, role, by: activeUsername })}
                        pinnedMessages={pinnedMessages}
                        onlineUsers={users.filter(u => u.isActive).map(u => u.name)}
                        unreadMessageId={unreadMessageId}
                        onJumpToMessage={() => { }}
                    />

                    {showSearch && (
                        <SearchPanel
                            isOpen={showSearch}
                            onClose={() => { setShowSearch(false); setSearchResults([]); }}
                            results={searchResults}
                            onSearch={handleSearchMessages}
                            onJumpToMessage={(msgId) => {
                                setShowSearch(false);
                                window.dispatchEvent(new CustomEvent('jumpToMessage', { detail: msgId }));
                            }}
                            users={users.map(u => ({ name: u.name, displayName: u.displayName, avatar: u.avatar }))}
                            isLoading={isSearching}
                        />
                    )}

                    <TypingIndicator users={typingUsers} />

                    <MessageInput
                        onSend={handleSend}
                        onFileUpload={handleFileUpload}
                        onVoiceRecord={handleVoiceRecord}
                        onSendGif={handleSendGif}
                        replyTo={replyingTo}
                        replyPreview={replyingTo ? `${replyingTo.sender}: ${replyingTo.message.substring(0, 50)}` : ''}
                        onCancelReply={() => setReplyingTo(null)}
                        disabled={!isConnected}
                        users={users.map(u => u.name)}
                        onTyping={(isTyping) => socket.emit('typing', { room: id, username: activeUsername, isTyping })}
                    />
                </div>

                <div className="shrink-0 transition-all duration-300 ease-in-out overflow-hidden h-full" style={{ width: showUserList ? '288px' : '0px', opacity: showUserList ? 1 : 0 }}>
                    <div className="w-72 h-full">
                        <UserList users={users} currentUser={activeUsername} isOpen={true} showToggle={false} onStartDM={!isGuest ? handleStartDM : undefined} onViewProfile={handleViewProfile} />
                    </div>
                </div>


            </div>

            {/* Invite Modal */}
            {inviteModalTargetUsername && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-[90%] max-w-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-bold mb-4 dark:text-white pb-3 border-b dark:border-gray-700 border-gray-200">
                            Invite {inviteModalTargetUsername}
                        </h3>
                        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto mb-4">
                            {rooms.filter(r => r.type === 'public' || r.members?.includes(activeUsername as string) || r.createdBy === activeUsername).length === 0 ? (
                                <div className="text-gray-500 dark:text-gray-400 py-4 text-center">No available rooms to invite.</div>
                            ) : (
                                rooms.filter(r => r.type === 'public' || r.members?.includes(activeUsername as string) || r.createdBy === activeUsername).map(room => (
                                    <button
                                        key={room._id}
                                        onClick={() => confirmInviteToRoom(room._id)}
                                        className="text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors bg-gray-50 dark:bg-gray-700/50 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black group border border-gray-100 dark:border-gray-600"
                                    >
                                        <div className="flex-1 min-w-0 font-medium">
                                            {room.name} {room.type === 'private' ? '(Private)' : ''}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="pt-3 border-t dark:border-gray-700 border-gray-200">
                            <button
                                onClick={() => setInviteModalTargetUsername(null)}
                                className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-semibold rounded-lg transition-colors border border-transparent dark:border-gray-600 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating DM Card */}
            <DMFloatingCard
                isOpen={showDMCard}
                onClose={() => { setShowDMCard(false); setDmBlockedInfo(null); }}
                currentUser={activeUsername}
                conversations={dmConversations}
                activeDMConversation={activeDMConversation}
                dmMessages={dmMessages}
                dmUnreadTotal={dmUnreadTotal}
                onStartDM={handleStartDM}
                onSendDMMessage={handleSendDMMessage}
                onDeleteDM={handleDeleteDMConversation}
                onMarkDMAsRead={handleMarkDMAsRead}
                onLoadDMMessages={handleLoadDMMessages}
                onViewProfile={handleViewProfile}
                onReactDM={handleReactDM}
                onDeleteDMMessage={handleDeleteDMMessage}
                onEditDMMessage={handleEditDMMessage}
                onSendDMGif={handleSendDMGif}
                onDMFileUpload={handleDMFileUpload}
                blockedInfo={dmBlockedInfo}
                onClearBlockedInfo={() => setDmBlockedInfo(null)}
            />

            {/* Floating DM Button - bottom right */}
            {!isGuest && (
                <button
                    onClick={() => setShowDMCard(true)}
                    className="fixed bottom-5 right-5 z-40 p-3.5 rounded-full shadow-lg transition-all hover:scale-110 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                    title="Direct Messages"
                >
                    <MessageCircle className="w-6 h-6" />
                    {dmUnreadTotal > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {dmUnreadTotal > 99 ? '99+' : dmUnreadTotal}
                        </span>
                    )}
                </button>
            )}
        </>
    );
}
