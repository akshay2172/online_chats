// frontend/components/DMFloatingCard.tsx
// frontend/components/DMFloatingCard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Search, X, User as UserIcon, MoreVertical, Trash2,
    ArrowLeft, Send, Paperclip, Image as ImageIcon, Loader2, Check, CheckCheck,
    Minimize2, Maximize2, Settings, Smile, Edit2, FileIcon, MessageSquare, PlusCircle
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
    isEdited?: boolean;
    editedAt?: string;
    replyTo?: string;
    replyToMessage?: { sender: string; message: string; messageId: string };
    reactions?: Array<{ emoji: string; users: string[] }>;
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
    onEditDMMessage, onSendDMGif, onDMFileUpload
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

    // Hover & Edit
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editMessageText, setEditMessageText] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { darkMode } = useDarkMode();

    const handleMinimizeToggle = () => {
        setIsMinimized(!isMinimized);
        if (onMinimize) onMinimize();
    };

    // Sync active chat from props
    useEffect(() => {
        if (isOpen && activeDMConversation) {
            setActiveChat(activeDMConversation);
            onLoadDMMessages(activeDMConversation._id);
            setIsMinimized(false);
        }
    }, [activeDMConversation, isOpen, onLoadDMMessages]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    const filteredConversations = conversations.filter((c) =>
        c.otherUser && (
            c.otherUser.username.toLowerCase().includes(search.toLowerCase()) ||
            c.otherUser.displayName?.toLowerCase().includes(search.toLowerCase())
        )
    );

    if (!isOpen) {
        if (dmUnreadTotal > 0) {
            return (
                <button
                    onClick={() => { setIsMinimized(false); onClose(); /* triggers parent open */ }}
                    className="fixed bottom-6 right-6 p-4 rounded-full bg-blue-500 text-white shadow-xl hover:bg-blue-600 transition-all z-50 flex items-center justify-center cursor-pointer"
                >
                    <MessageCircle className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                        {dmUnreadTotal > 99 ? '99+' : dmUnreadTotal}
                    </span>
                </button>
            );
        }
        return null;
    }

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
                width: activeChat ? '750px' : '350px',
                height: '550px' // Taller for good view
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

            {/* RIGHT PANEL: Active Chat */}
            {activeChat && (
                <div className="flex flex-col h-full w-2/3 bg-black/5 dark:bg-white/5 relative">

                    {/* Chat Header */}
                    <div className="p-3 border-b flex justify-between items-center bg-white dark:bg-gray-900 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
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
                            <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setActiveChat(null)}>
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-gray-50 dark:bg-gray-900/50">
                        {dmMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: 'var(--text-muted)' }}>
                                <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm">No messages yet.</p>
                                <p className="text-xs">Say hello to {activeChat.otherUser.username}!</p>
                            </div>
                        ) : (
                            dmMessages.map((msg, index) => {
                                const isMine = msg.sender === currentUser;
                                const isHovered = hoveredMessageId === msg._id;

                                return (
                                    <div
                                        key={msg._id}
                                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full group`}
                                        onMouseEnter={() => setHoveredMessageId(msg._id)}
                                        onMouseLeave={() => setHoveredMessageId(null)}
                                    >
                                        {/* Username/Time Header */}
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>

                                        {/* Message Bubble Wrapper */}
                                        <div className="relative group max-w-[85%] flex items-center gap-2">
                                            {/* Hover Actions (Left for Mine, Right for Theirs) */}
                                            {isHovered && isMine && (
                                                <div className="flex gap-1 mr-1 shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-0.5 absolute right-full top-0">
                                                    <button onClick={() => setEditingMessageId(msg._id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                                    <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500" title="Reply"><MessageSquare className="w-3 h-3" /></button>
                                                    <button onClick={() => onDeleteDMMessage(activeChat._id, msg._id)} className="p-1 hover:bg-red-50 text-red-500 dark:hover:bg-red-900/20 rounded" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            )}

                                            <div
                                                className={`rounded-2xl px-3 py-2 text-sm relative break-words shadow-sm ${isMine
                                                    ? 'bg-blue-500 text-white rounded-tr-none'
                                                    : 'bg-white dark:bg-gray-800 text-gray-900 border dark:border-gray-700 dark:text-gray-100 rounded-tl-none'
                                                    }`}
                                            >
                                                {msg.replyToMessage && (
                                                    <div className={`mb-1.5 p-1.5 rounded text-xs border-l-2 ${isMine ? 'bg-blue-600 border-white text-blue-100' : 'bg-gray-100 border-blue-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                        <span className="font-semibold">{msg.replyToMessage.sender}</span>
                                                        <div className="truncate opacity-80 mt-0.5">{msg.replyToMessage.message}</div>
                                                    </div>
                                                )}

                                                {editingMessageId === msg._id ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={editMessageText || msg.message}
                                                            onChange={(e) => setEditMessageText(e.target.value)}
                                                            className="bg-black/20 text-white rounded px-2 py-1 outline-none text-sm"
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
                                                        ) : msg.messageType === 'file' && msg.fileData?.url ? (
                                                            <a href={msg.fileData.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
                                                                <FileIcon className="w-4 h-4" /> {msg.fileData.originalName}
                                                            </a>
                                                        ) : (
                                                            <div className="whitespace-pre-wrap">{msg.message}</div>
                                                        )}

                                                        {msg.isEdited && <span className="text-[9px] opacity-70 ml-2 italic">edited</span>}

                                                        {/* Reactions inline */}
                                                        {msg.reactions && msg.reactions.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1 -mb-3 pt-1 border-t border-black/10">
                                                                {msg.reactions.map(r => (
                                                                    <span key={r.emoji} className="bg-black/20 text-xs px-1 rounded-full cursor-pointer" onClick={() => onReactDM(activeChat._id, msg._id, r.emoji, r.users.includes(currentUser) ? 'remove' : 'add')}>
                                                                        {r.emoji} {r.users.length > 1 && <span className="text-[10px] ml-0.5">{r.users.length}</span>}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {isHovered && !isMine && (
                                                <div className="flex gap-1 ml-1 shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-0.5 absolute left-full top-0">
                                                    <button onClick={() => onReactDM(activeChat._id, msg._id, '👍', 'add')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="React Thumb">👍</button>
                                                    <button onClick={() => onReactDM(activeChat._id, msg._id, '❤️', 'add')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="React Heart">❤️</button>
                                                    <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500" title="Reply"><MessageSquare className="w-3 h-3" /></button>
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
                        <div className="absolute bottom-[60px] left-2 z-50 shadow-2xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 w-[300px] h-[350px] flex flex-col">
                            <input type="text" placeholder="Search Tenor GIFs..." value={gifSearch} onChange={e => { setGifSearch(e.target.value); searchTenorGifs(e.target.value); }} className="w-full p-2 text-sm border rounded mb-2 bg-gray-50 dark:bg-gray-800" />
                            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-1 content-start">
                                {isLoadingGifs ? <div className="col-span-2 flex justify-center py-4"><Loader2 className="animate-spin" /></div> : gifs.map((g, i) => (
                                    <img key={i} src={g.media_formats?.tinygif?.url} onClick={() => handleSendGif(g)} className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80" alt="gif" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-gray-900 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        {replyTo && (
                            <div className="flex justify-between items-center mb-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg border-l-2 border-blue-500">
                                <div className="truncate">Replying to <span className="font-semibold">{replyTo.sender}</span>: {replyTo.message}</div>
                                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><X className="w-3 h-3" /></button>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                className="p-1.5 text-gray-500 hover:text-blue-500 transition-colors"
                                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                            >
                                <Smile className="w-5 h-5" />
                            </button>
                            <button
                                className="p-1.5 text-gray-500 hover:text-blue-500 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <button
                                className="p-1 text-gray-500 hover:text-blue-500 font-bold font-mono border rounded px-1 min-w-[32px] text-center"
                                onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); searchTenorGifs(''); }}
                            >
                                GIF
                            </button>

                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Message..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                className="flex-1 bg-gray-100 dark:bg-gray-800 border-0 rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!messageText.trim() && !fileInputRef.current?.value}
                                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5 mt-0.5" />}
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
