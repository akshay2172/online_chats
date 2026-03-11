// frontend/components/DMFloatingCard.tsx
// frontend/components/DMFloatingCard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Search, X, User as UserIcon, MoreVertical, Trash2,
    ArrowLeft, Send, Paperclip, Image as ImageIcon, Loader2, Check, CheckCheck,
    Minimize2, Maximize2, Settings, Smile, Edit2, FileIcon, MessageSquare, PlusCircle,
    Mic, MicOff, Copy, Reply, Ban, Forward, Pin, PinOff, Flag, AtSign
} from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { useDarkMode } from '../pages/_app';

interface DMConversation {
    _id: string;
    participants: string[];
    lastMessage: string;
    lastMessageSender?: string;
    lastMessageAt: string;
    unreadCount: number;
    otherUser: {
        username: string;
        avatar?: string;
        status?: string;
        displayName?: string;
        bio?: string;
    };
}

interface DMMsg {
    _id: string;
    conversationId: string;
    sender: string;
    receiver: string;
    message: string;
    messageType?: string;
    fileData?: any;
    readAt?: string;
    deliveredAt?: string;
    isEdited?: boolean;
    editedAt?: string;
    replyTo?: string;
    replyToMessage?: { sender: string; message: string; messageId: string };
    reactions?: Array<{ emoji: string; users: string[] }>;
    isPinned?: boolean;
    isReported?: boolean;
    createdAt: string;
}

interface DMFloatingCardProps {
    isOpen: boolean;
    onClose: () => void;
    onMinimize?: () => void;
    currentUser: string;
    conversations: DMConversation[];
    activeDMConversation: DMConversation | null;
    dmMessages: DMMsg[];
    dmUnreadTotal: number;
    onStartDM: (username: string) => void;
    onSendDMMessage: (conversationId: string, message: string, receiver: string, messageType?: string, fileData?: any, replyTo?: string) => void;
    onDeleteDM: (conversationId: string) => void;
    onMarkDMAsRead: (conversationId: string) => void;
    onLoadDMMessages: (conversationId: string) => void;
    onViewProfile?: (username: string) => void;
    onReactDM: (conversationId: string, messageId: string, emoji: string, action: 'add' | 'remove') => void;
    onDeleteDMMessage: (conversationId: string, messageId: string) => void;
    onEditDMMessage: (conversationId: string, messageId: string, newMessage: string) => void;
    onSendDMGif: (conversationId: string, receiver: string, gifUrl: string, gifData: any) => void;
    onDMFileUpload: (conversationId: string, receiver: string, file: File) => void;
    blockedInfo?: {
        targetUsername: string;
        direction: 'blockedByTarget' | 'blockedByYou';
        message: string;
        targetUser?: { username: string; avatar?: string; displayName?: string; status?: string };
    } | null;
    onClearBlockedInfo?: () => void;
    onPinDMMessage?: (conversationId: string, messageId: string) => void;
    onUnpinDMMessage?: (conversationId: string, messageId: string) => void;
    onReportDMMessage?: (conversationId: string, messageId: string) => void;
}

const getStatusColor = (status?: string) => {
    switch (status) {
        case 'online': return '#22c55e';
        case 'away': return '#eab308';
        case 'busy': return '#ef4444';
        default: return '#9ca3af';
    }
};

const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60 * 1000) return 'now';
    if (diff < 24 * 60 * 60 * 1000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 7 * 24 * 60 * 60 * 1000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';

export default function DMFloatingCard({
    isOpen, onClose, onMinimize, currentUser, conversations, activeDMConversation,
    dmMessages, dmUnreadTotal, onStartDM, onSendDMMessage, onDeleteDM,
    onMarkDMAsRead, onLoadDMMessages, onViewProfile, onReactDM, onDeleteDMMessage,
    onEditDMMessage, onSendDMGif, onDMFileUpload, blockedInfo, onClearBlockedInfo,
    onPinDMMessage, onUnpinDMMessage, onReportDMMessage
}: DMFloatingCardProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [search, setSearch] = useState('');
    const [activeChat, setActiveChat] = useState<DMConversation | null>(null);

    // Input states
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [replyTo, setReplyTo] = useState<DMMsg | null>(null);

    // Pickers
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifSearch, setGifSearch] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [isLoadingGifs, setIsLoadingGifs] = useState(false);

    // Hover & Edit & Menu
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editMessageText, setEditMessageText] = useState('');
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // DM Message Search
    const [showDMSearch, setShowDMSearch] = useState(false);
    const [dmSearchQuery, setDmSearchQuery] = useState('');

    // Voice Recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { darkMode } = useDarkMode();

    const handleMinimizeToggle = () => {
        setIsMinimized(!isMinimized);
        if (onMinimize) onMinimize();
    };

    useEffect(() => {
        if (isOpen && activeDMConversation) {
            setActiveChat(activeDMConversation);
            onLoadDMMessages(activeDMConversation._id);
            setIsMinimized(false);
        }
    }, [activeDMConversation, isOpen, onLoadDMMessages]);

    // Sync active chat if it exists in conversations (to catch unreadCount updates)
    useEffect(() => {
        if (activeChat) {
            const updated = conversations.find(c => c._id === activeChat._id);
            if (updated && updated.unreadCount !== activeChat.unreadCount) {
                setActiveChat({ ...activeChat, ...updated });
            }
        }
    }, [conversations, activeChat]);

    // Scroll to bottom (only on new messages, not reactions)
    const prevMessageCount = useRef(0);
    useEffect(() => {
        if (dmMessages.length > prevMessageCount.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevMessageCount.current = dmMessages.length;
    }, [dmMessages, isOpen, activeChat]);

    // Mark auto-read
    useEffect(() => {
        if (isOpen && !isMinimized && activeChat && activeChat.unreadCount > 0) {
            onMarkDMAsRead(activeChat._id);
        }
    }, [isOpen, isMinimized, activeChat, activeChat?.unreadCount, onMarkDMAsRead]);

    const openChat = (conv: DMConversation) => {
        setActiveChat(conv);
        onLoadDMMessages(conv._id);
        if (conv.unreadCount > 0) {
            onMarkDMAsRead(conv._id);
        }
        setReplyTo(null);
        setSearch('');
        if (onClearBlockedInfo) onClearBlockedInfo();
    };

    const handleSend = () => {
        if (!messageText.trim() || !activeChat) return;
        setIsSending(true);
        onSendDMMessage(
            activeChat._id,
            messageText.trim(),
            activeChat.otherUser.username,
            'text',
            null,
            replyTo ? replyTo._id : undefined
        );
        setMessageText('');
        setReplyTo(null);
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
        setTimeout(() => setIsSending(false), 200);
        inputRef.current?.focus();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeChat) return;
        if (file.size > 30 * 1024 * 1024) {
            alert('File size must be less than 30MB');
            return;
        }
        await onDMFileUpload(activeChat._id, activeChat.otherUser.username, file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const searchTenorGifs = async (query: string) => {
        setIsLoadingGifs(true);
        try {
            const endpoint = query
                ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`
                : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20`;
            const response = await fetch(endpoint);
            const data = await response.json();
            setGifs(data.results || []);
        } catch (e) {
            console.error(e);
            setGifs([]);
        } finally {
            setIsLoadingGifs(false);
        }
    };

    const handleSendGif = (gif: any) => {
        if (!activeChat) return;
        const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url;
        const gifData = {
            width: gif.media_formats?.gif?.dims?.[0] || 400,
            height: gif.media_formats?.gif?.dims?.[1] || 300,
            preview: gif.media_formats?.tinygif?.url || gifUrl,
        };
        onSendDMGif(activeChat._id, activeChat.otherUser.username, gifUrl, gifData);
        setShowGifPicker(false);
        setGifSearch('');
    };

    const handleEditSave = (msgId: string) => {
        if (!activeChat || !editMessageText.trim()) return;
        onEditDMMessage(activeChat._id, msgId, editMessageText.trim());
        setEditingMessageId(null);
        setEditMessageText('');
    };

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text);
        setActiveMenuId(null);
    };

    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            setRecordingDuration(0);
            recordingIntervalRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 0 && activeChat) {
                    // Upload via the file upload handler (treat as file)
                    const file = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
                    onDMFileUpload(activeChat._id, activeChat.otherUser.username, file);
                }
                setIsRecording(false);
                setRecordingDuration(0);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Mic access denied:', err);
        }
    };

    const stopVoiceRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const cancelVoiceRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current.stop();
        }
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingDuration(0);
    };

    const filteredConversations = conversations.filter((c) =>
        c.otherUser && (
            c.otherUser.username.toLowerCase().includes(search.toLowerCase()) ||
            c.otherUser.displayName?.toLowerCase().includes(search.toLowerCase())
        )
    );

    if (!isOpen) return null;


    if (isMinimized) {
        return (
            <div
                className="fixed bottom-0 right-10 w-64 h-12 rounded-t-xl shadow-[0_-4px_15px_rgba(0,0,0,0.1)] border border-b-0 cursor-pointer overflow-hidden flex items-center justify-between px-4 z-50 transition-colors"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                onClick={handleMinimizeToggle}
            >
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Messages</span>
                    {dmUnreadTotal > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">
                            {dmUnreadTotal > 99 ? '99+' : dmUnreadTotal}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); handleMinimizeToggle(); }}><Maximize2 className="w-4 h-4" /></button>
                    <button className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); onClose(); }}><X className="w-4 h-4" /></button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed bottom-0 right-10 shadow-[0_-4px_25px_rgba(0,0,0,0.15)] flex flex-row overflow-hidden z-50 rounded-t-xl transition-all"
            style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                borderWidth: '1px',
                borderBottomWidth: 0,
                width: (activeChat || blockedInfo) ? '850px' : '380px',
                height: '620px'
            }}
        >
            {/* LEFT PANEL: Conversation List */}
            <div
                className={`flex flex-col h-full shrink-0 transition-all ${activeChat ? 'w-1/3 border-r' : 'w-full'}`}
                style={{ borderColor: 'var(--border-color)' }}
            >
                <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Chats</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={handleMinimizeToggle}><Minimize2 className="w-4 h-4" /></button>
                        <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={onClose}><X className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg outline-none transition-colors border"
                            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                            No messages yet
                        </div>
                    ) : filteredConversations.map((conv) => (
                        <div
                            key={conv._id}
                            onClick={() => openChat(conv)}
                            className="relative p-3 flex items-center gap-3 cursor-pointer transition-colors border-b last:border-0 group select-none"
                            style={{
                                backgroundColor: activeChat?._id === conv._id ? 'var(--bg-tertiary)' : 'transparent',
                                borderColor: 'var(--border-color)'
                            }}
                            onMouseEnter={(e) => {
                                if (activeChat?._id !== conv._id) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                            }}
                            onMouseLeave={(e) => {
                                if (activeChat?._id !== conv._id) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <div className="relative shrink-0 w-10 h-10">
                                {conv.otherUser.avatar ? (
                                    <img src={conv.otherUser.avatar} alt={conv.otherUser.username} className="w-10 h-10 rounded-full object-cover border" style={{ borderColor: 'var(--border-color)' }} />
                                ) : (
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg text-white" style={{ backgroundColor: 'var(--accent-color)' }}>
                                        {conv.otherUser.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div
                                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2"
                                    style={{ backgroundColor: getStatusColor(conv.otherUser.status), borderColor: 'var(--bg-primary)' }}
                                />
                            </div>

                            <div className="flex-1 min-w-0 pr-6">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                        {conv.otherUser.displayName || conv.otherUser.username}
                                    </span>
                                    <span className="text-[10px] shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                                        {formatTime(conv.lastMessageAt)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    {conv.lastMessageSender === currentUser && (
                                        <CheckCheck className="w-3 h-3 shrink-0" style={{ color: 'var(--accent-color)' }} />
                                    )}
                                    <p className="text-xs truncate max-w-[120px]" style={{ color: conv.unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
                                        {conv.lastMessage || 'Sent a file'}
                                    </p>
                                </div>
                            </div>

                            {conv.unreadCount > 0 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT PANEL: Blocked State */}
            {!activeChat && blockedInfo && (
                <div className="flex flex-col h-full w-2/3 relative" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {/* Blocked Header */}
                    <div className="p-3 border-b flex justify-between items-center shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-8 h-8 shrink-0">
                                {blockedInfo.targetUser?.avatar ? (
                                    <img src={blockedInfo.targetUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: '#ef4444' }}>
                                        {blockedInfo.targetUsername.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                    {blockedInfo.targetUser?.displayName || blockedInfo.targetUsername}
                                </div>
                                <div className="text-[10px] text-red-500 font-medium">Blocked</div>
                            </div>
                        </div>
                    </div>

                    {/* Blocked Message Body */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                            <Ban className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            {blockedInfo.direction === 'blockedByYou'
                                ? 'You have blocked this user'
                                : 'You are blocked by this user'}
                        </p>
                        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                            {blockedInfo.direction === 'blockedByYou'
                                ? 'Unblock them from their profile to send messages.'
                                : 'You cannot send messages to this user.'}
                        </p>
                    </div>

                    {/* Disabled Input */}
                    <div className="p-3 border-t opacity-50 pointer-events-none" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="You can't message this user"
                                disabled
                                className="flex-1 rounded-full px-4 py-2 text-sm cursor-not-allowed border"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
                            />
                            <button disabled className="p-2 bg-gray-400 text-white rounded-full cursor-not-allowed">
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RIGHT PANEL: Active Chat */}
            {activeChat && (
                <div className="flex flex-col h-full w-2/3 relative" style={{ backgroundColor: 'var(--bg-secondary)' }}>

                    {/* Chat Header */}
                    <div className="p-3 border-b flex flex-col gap-2 shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onViewProfile && onViewProfile(activeChat.otherUser.username)}>
                                <div className="relative w-8 h-8 shrink-0">
                                    {activeChat.otherUser.avatar ? (
                                        <img src={activeChat.otherUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: 'var(--accent-color)' }}>
                                            {activeChat.otherUser.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: getStatusColor(activeChat.otherUser.status), borderColor: 'var(--bg-primary)' }} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{activeChat.otherUser.displayName || activeChat.otherUser.username}</div>
                                    <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                        {activeChat.otherUser.status === 'online' ? 'Active now' : 'Offline'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    className="p-1.5 rounded-lg transition-colors"
                                    style={{ color: showDMSearch ? 'var(--accent-color)' : 'var(--text-muted)' }}
                                    onClick={() => { setShowDMSearch(!showDMSearch); setDmSearchQuery(''); }}
                                    title="Search messages"
                                >
                                    <Search className="w-4 h-4" />
                                </button>
                                <button
                                    className="p-1.5 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onClick={() => { setActiveChat(null); setShowDMSearch(false); setDmSearchQuery(''); }}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {showDMSearch && (
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search messages..."
                                        value={dmSearchQuery}
                                        onChange={(e) => setDmSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border"
                                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                                        autoFocus
                                    />
                                </div>
                                {dmSearchQuery && (
                                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                                        {dmMessages.filter(m => m.message.toLowerCase().includes(dmSearchQuery.toLowerCase())).length} results
                                    </span>
                                )}
                                <button onClick={() => { setShowDMSearch(false); setDmSearchQuery(''); }} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 relative" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {dmMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: 'var(--text-muted)' }}>
                                <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm">No messages yet.</p>
                                <p className="text-xs">Say hello to {activeChat.otherUser.username}!</p>
                            </div>
                        ) : (
                            (dmSearchQuery
                                ? dmMessages.filter(m => m.message.toLowerCase().includes(dmSearchQuery.toLowerCase()))
                                : dmMessages
                            ).map((msg, index) => {
                                const isMine = msg.sender === currentUser;
                                const isHovered = hoveredMessageId === msg._id || activeMenuId === msg._id;
                                const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

                                return (
                                    <div
                                        key={msg._id}
                                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full group`}
                                        onMouseEnter={() => setHoveredMessageId(msg._id)}
                                        onMouseLeave={() => { if (activeMenuId !== msg._id) setHoveredMessageId(null); }}
                                    >


                                        {/* Message Bubble Wrapper */}
                                        <div className="relative max-w-[70%] flex flex-col gap-1 min-w-0">
                                            {/* Three-dot menu (left of mine, right of theirs) */}
                                            {isHovered && (
                                                <div className={`flex gap-0.5 shrink-0 rounded-lg shadow-sm border p-0.5 absolute ${isMine ? 'right-full mr-1' : 'left-full ml-1'} top-0 z-20`} style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === msg._id ? null : msg._id); }}
                                                        className="p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                                                        title="More options"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5" />
                                                    </button>

                                            {/* Dropdown Menu */}
                                            {activeMenuId === msg._id && (
                                                <div
                                                    className={`absolute ${isMine ? 'right-0' : 'left-0'} top-full mt-1 rounded-xl shadow-xl py-1.5 min-w-[160px] z-30 border`}
                                                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {/* Quick Reactions Row */}
                                                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                                        <div className="flex justify-between">
                                                            {quickReactions.map((emoji) => {
                                                                const hasReacted = msg.reactions?.some(r => r.emoji === emoji && r.users.includes(currentUser));
                                                                return (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => { onReactDM(activeChat._id, msg._id, emoji, hasReacted ? 'remove' : 'add'); setActiveMenuId(null); }}
                                                                        className={`text-base hover:scale-125 transition-transform ${hasReacted ? 'scale-110 opacity-100' : 'opacity-70'}`}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* More reactions */}
                                                    <button
                                                        onClick={() => { setShowEmojiPicker(true); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        <Smile className="w-4 h-4" /> More reactions
                                                    </button>

                                                    <button
                                                        onClick={() => { setReplyTo(msg); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        <Reply className="w-4 h-4" /> Reply
                                                    </button>

                                                    <button
                                                        onClick={() => handleCopyText(msg.message)}
                                                        className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        <Copy className="w-4 h-4" /> Copy text
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            localStorage.setItem('forwardedMessage', JSON.stringify({ text: msg.message, sender: msg.sender }));
                                                            setActiveMenuId(null);
                                                            window.dispatchEvent(new CustomEvent('showToast', { detail: 'Message ready to forward!' }));
                                                        }}
                                                        className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        <Forward className="w-4 h-4" /> Forward
                                                    </button>

                                                    {msg.isPinned ? (
                                                        <button onClick={() => { onUnpinDMMessage?.(activeChat._id, msg._id); setActiveMenuId(null); }}
                                                            className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                            style={{ color: 'var(--text-primary)' }}>
                                                            <PinOff className="w-4 h-4" /> Unpin
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => { onPinDMMessage?.(activeChat._id, msg._id); setActiveMenuId(null); }}
                                                            className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                            style={{ color: 'var(--text-primary)' }}>
                                                            <Pin className="w-4 h-4" /> Pin
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => { onReportDMMessage?.(activeChat._id, msg._id); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2 text-sm flex items-center gap-2 text-orange-600 transition-colors hover:opacity-80"
                                                    >
                                                        <Flag className="w-4 h-4" /> Report
                                                    </button>

                                                    {isMine && msg.messageType === 'text' && (
                                                        <button
                                                            onClick={() => { setEditingMessageId(msg._id); setEditMessageText(msg.message); setActiveMenuId(null); }}
                                                            className="w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                                                            style={{ color: 'var(--text-primary)' }}
                                                        >
                                                            <Edit2 className="w-4 h-4" /> Edit
                                                        </button>
                                                    )}

                                                    {isMine && (
                                                        <button
                                                            onClick={() => { onDeleteDMMessage(activeChat._id, msg._id); setActiveMenuId(null); }}
                                                            className="w-full px-4 py-2 text-sm flex items-center gap-2 text-red-500 transition-colors hover:opacity-80"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                                </div>
                                            )}

                                            {/* Message Bubble */}
                                            <div
                                                className={`rounded-2xl px-3 py-2 text-sm relative break-words overflow-hidden shadow-sm min-w-0 ${isMine
                                                    ? 'bg-blue-500 text-white rounded-tr-none'
                                                    : 'rounded-tl-none'
                                                    }`}
                                                style={!isMine ? { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', wordBreak: 'break-word' } : { wordBreak: 'break-word' }}
                                            >
                                                {msg.replyToMessage && (
                                                    <div className={`mb-1.5 p-1.5 rounded text-xs border-l-2 ${isMine ? 'bg-blue-600 border-white text-blue-100' : ''}`}
                                                        style={!isMine ? { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--accent-color)', color: 'var(--text-secondary)' } : {}}
                                                    >
                                                        <span className="font-semibold">{msg.replyToMessage.sender}</span>
                                                        <div className="truncate opacity-80 mt-0.5">{msg.replyToMessage.message}</div>
                                                    </div>
                                                )}

                                                {editingMessageId === msg._id ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={editMessageText}
                                                            onChange={(e) => setEditMessageText(e.target.value)}
                                                            className="rounded px-2 py-1 outline-none text-sm"
                                                            style={{ backgroundColor: isMine ? 'rgba(0,0,0,0.2)' : 'var(--bg-secondary)', color: isMine ? 'white' : 'var(--text-primary)' }}
                                                            autoFocus
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(msg._id); if (e.key === 'Escape') setEditingMessageId(null); }}
                                                        />
                                                        <button onClick={() => handleEditSave(msg._id)} className="p-1"><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingMessageId(null)} className="p-1"><X className="w-4 h-4" /></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {msg.messageType === 'gif' ? (
                                                            <img src={msg.message} alt="GIF" className="rounded-lg max-w-full h-auto" style={{ maxHeight: '200px' }} />
                                                        ) : msg.messageType === 'image' && msg.fileData?.url ? (
                                                            <a href={msg.fileData.url} target="_blank" rel="noopener noreferrer">
                                                                <img src={msg.fileData.url} alt="Uploaded Image" className="rounded-lg max-w-full h-auto my-1" style={{ maxHeight: '200px' }} />
                                                            </a>
                                                        ) : (msg.messageType === 'voice' || (msg.messageType === 'file' && msg.fileData?.mimetype?.startsWith('audio/'))) && msg.fileData?.url ? (
                                                            <div className="flex items-center gap-2 p-1">
                                                                <audio controls preload="metadata" className="max-w-[200px] h-8" style={{ filter: isMine ? 'invert(1)' : 'none' }}>
                                                                    <source src={msg.fileData.url} type={msg.fileData.mimetype || 'audio/webm'} />
                                                                </audio>
                                                            </div>
                                                        ) : msg.messageType === 'file' && msg.fileData?.url ? (
                                                            <a href={msg.fileData.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
                                                                <FileIcon className="w-4 h-4" /> {msg.fileData.originalName}
                                                            </a>
                                                        ) : (
                                                            <div className="whitespace-pre-wrap message-text min-w-0">{msg.message}</div>
                                                        )}

                                                        {msg.isEdited && <span className="text-[9px] opacity-70 ml-2 italic">edited</span>}

                                                        {/* Timestamp & Read Receipt */}
                                                        <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-blue-100' : ''}`}
                                                            style={!isMine ? { color: 'var(--text-muted)' } : {}}
                                                        >
                                                            <span className="text-[10px] opacity-70">{formatTime(msg.createdAt)}</span>
                                                            {isMine && (
                                                                msg.readAt ? (
                                                                    <CheckCheck className="w-3.5 h-3.5" style={{ color: '#4ADE80' }} />
                                                                ) : msg.deliveredAt ? (
                                                                    <CheckCheck className="w-3.5 h-3.5 opacity-50" />
                                                                ) : (
                                                                    <Check className="w-3.5 h-3.5 opacity-50" />
                                                                )
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Reactions OUTSIDE the bubble */}
                                            {msg.reactions && msg.reactions.length > 0 && (
                                                <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                    {msg.reactions.map(r => (
                                                        <span key={r.emoji} className="text-xs px-1.5 py-0.5 rounded-full cursor-pointer border"
                                                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                                                            onClick={() => onReactDM(activeChat._id, msg._id, r.emoji, r.users.includes(currentUser) ? 'remove' : 'add')}>
                                                            {r.emoji} {r.users.length > 1 && <span className="text-[10px] ml-0.5">{r.users.length}</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Floating Pickers */}
                    {showEmojiPicker && (
                        <div className="absolute bottom-[60px] left-2 z-50 shadow-2xl rounded-xl">
                            <EmojiPicker onEmojiClick={(e: EmojiClickData) => setMessageText(prev => prev + e.emoji)} theme={darkMode ? EmojiTheme.DARK : EmojiTheme.LIGHT} width={300} height={350} />
                        </div>
                    )}

                    {showGifPicker && (
                        <div className="absolute bottom-[60px] left-2 z-50 shadow-2xl rounded-xl p-2 w-[300px] h-[350px] flex flex-col border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <input type="text" placeholder="Search Tenor GIFs..." value={gifSearch} onChange={e => { setGifSearch(e.target.value); searchTenorGifs(e.target.value); }} className="w-full p-2 text-sm rounded mb-2 border outline-none" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }} />
                            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-1 content-start">
                                {isLoadingGifs ? <div className="col-span-2 flex justify-center py-4"><Loader2 className="animate-spin" /></div> : gifs.map((g, i) => (
                                    <img key={i} src={g.media_formats?.tinygif?.url} onClick={() => handleSendGif(g)} className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80" alt="gif" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    {blockedInfo && activeChat && blockedInfo.targetUsername === activeChat.otherUser.username ? (
                        <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                            <div className="flex items-center justify-center gap-2 text-red-500 text-sm py-1">
                                <Ban className="w-4 h-4" />
                                <span className="font-medium">
                                    {blockedInfo.direction === 'blockedByYou'
                                        ? 'You have blocked this user. Unblock to send messages.'
                                        : 'This user has blocked you.'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                            {replyTo && (
                                <div className="flex justify-between items-center mb-2 px-2 py-1 text-xs rounded-lg border-l-2 border-blue-500" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                    <div className="truncate" style={{ color: 'var(--text-primary)' }}>Replying to <span className="font-semibold">{replyTo.sender}</span>: {replyTo.message}</div>
                                    <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:opacity-70"><X className="w-3 h-3" /></button>
                                </div>
                            )}

                            {/* Voice Recording UI */}
                            {isRecording ? (
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recording... {recordingDuration}s</span>
                                    </div>
                                    <button onClick={cancelVoiceRecording} className="p-2 rounded-full hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Cancel">
                                        <X className="w-5 h-5" />
                                    </button>
                                    <button onClick={stopVoiceRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors" title="Send Voice">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        className="p-1.5 transition-colors" style={{ color: 'var(--text-muted)' }}
                                        onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                                    >
                                        <Smile className="w-5 h-5" />
                                    </button>
                                    <button
                                        className="p-1.5 transition-colors" style={{ color: 'var(--text-muted)' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <button
                                        className="p-1 font-bold font-mono border rounded px-1 min-w-[32px] text-center text-xs" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
                                        onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); searchTenorGifs(''); }}
                                    >
                                        GIF
                                    </button>
                                    <button
                                        className="p-1.5 transition-colors" style={{ color: 'var(--text-muted)' }}
                                        onClick={startVoiceRecording}
                                        title="Voice Message"
                                    >
                                        <Mic className="w-5 h-5" />
                                    </button>

                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                                    <textarea
                                        ref={inputRef}
                                        placeholder="Message..."
                                        value={messageText}
                                        onChange={(e) => {
                                            setMessageText(e.target.value);
                                            // Auto-resize
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        rows={1}
                                        className="flex-1 rounded-2xl px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none border resize-none"
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            borderColor: 'var(--border-color)',
                                            maxHeight: '100px',
                                            overflowY: 'auto',
                                            overflowX: 'hidden',
                                        }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!messageText.trim() && !fileInputRef.current?.value}
                                        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5 mt-0.5" />}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
