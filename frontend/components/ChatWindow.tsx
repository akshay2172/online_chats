// frontend/components/ChatWindow.tsx - ENHANCED WITH THEME & INTERACTIONS
import React, { useEffect, useRef, useState, useCallback } from 'react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import {
  MoreVertical,
  Reply,
  Flag,
  Trash2,
  X,
  MessageSquare,
  Smile,
  Check,
  CheckCheck,
  Edit,
  Pin,
  PinOff,
  Search,
  Image as ImageIcon,
  File,
  Download,
  Play,
  Copy,
  Forward,
  AtSign,
  UserX,
  Shield,
  Ban,
  UserCheck,
  Crown,
  Bell,
  BellOff,
} from 'lucide-react';
import { useDarkMode } from '../pages/_app';
import LinkPreview from './LinkPreview';

export interface Message {
  _id?: string;
  id?: string | number;
  sender: string;
  message: string;
  editedMessage?: string;
  reactions?: Array<{ emoji: string; users: string[] }>;
  replyTo?: string | null;
  replyToMessage?: { sender: string; message: string; messageId: string };
  isReported?: boolean;
  timestamp?: string;
  createdAt?: string;
  isRead?: boolean;
  readBy?: string[];
  avatar?: string;
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
  messageType?: 'text' | 'file' | 'image' | 'voice' | 'gif' | 'sticker';
  fileData?: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
  };
  mentions?: string[];
  status?: 'online' | 'away' | 'busy' | 'offline';
}

interface Props {
  messages: Message[];
  onUpdateMessage?: (idx: number, updatedMsg: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onReportMessage?: (messageId: string) => void;
  onReplyToMessage?: (message: Message) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  onReact: (messageId: string, emoji: string, action: 'add' | 'remove') => void;
  onKickUser?: (username: string) => void;
  onBanUser?: (username: string) => void;
  onPlatformBanUser?: (username: string) => void;
  onBlockUser?: (username: string) => void;
  onMuteUser?: (username: string) => void;
  onUnmuteUser?: (username: string) => void;
  onPromoteUser?: (username: string, role: 'admin' | 'moderator' | 'member') => void;
  roomName?: string;
  currentUser?: string;
  currentUserRole?: 'owner' | 'admin' | 'moderator' | 'member';
  currentUserGlobalRole?: 'owner' | 'admin' | 'global_mod' | 'user';
  replyTo?: Message | null;
  onCancelReply?: () => void;
  onSearch?: (query: string) => void;
  pinnedMessages?: Message[];
  onlineUsers?: string[];
  unreadMessageId?: string | null;
  showSearch?: boolean;
  onToggleSearch?: () => void;
  onJumpToMessage?: (messageId: string) => void;
  highlightedMessageId?: string | null;
  users?: Array<{ name: string; displayName?: string; status?: string; avatar?: string; role?: string; globalRole?: string }>;
}

const ChatWindow: React.FC<Props> = ({
  messages,
  onDeleteMessage,
  onReportMessage,
  onReplyToMessage,
  onEditMessage,
  onPinMessage,
  onUnpinMessage,
  onKickUser,
  onBanUser,
  onPlatformBanUser,
  onBlockUser,
  onMuteUser,
  onUnmuteUser,
  onPromoteUser,
  roomName = '',
  currentUser = 'You',
  currentUserRole = 'member',
  currentUserGlobalRole = 'user',
  replyTo,
  onReact,
  onCancelReply,
  onSearch,
  pinnedMessages = [],
  onlineUsers = [],
  unreadMessageId = null,
  showSearch = false,
  onToggleSearch,
  onJumpToMessage,
  highlightedMessageId,
  users = [],
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showPinned, setShowPinned] = useState(false);
  const [tempHighlight, setTempHighlight] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { darkMode } = useDarkMode();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    if (shouldAutoScroll.current) scrollToBottom();
  }, [messages]);

  const onScroll = () => {
    const el = chatRef.current;
    if (el) {
      shouldAutoScroll.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
      setActiveEmojiPicker(null);
    };

    if (activeMenu !== null || activeEmojiPicker !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu, activeEmojiPicker]);

  const calculateMenuPosition = (messageId: string) => {
    const messageEl = messageRefs.current.get(messageId);
    const chatEl = chatRef.current;

    if (messageEl && chatEl) {
      const messageRect = messageEl.getBoundingClientRect();
      const chatRect = chatEl.getBoundingClientRect();
      const spaceBelow = chatRect.bottom - messageRect.bottom;

      return spaceBelow < 400 ? 'top' : 'bottom';
    }

    return 'bottom';
  };

  const handleMenuToggle = (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeMenu === messageId) {
      setActiveMenu(null);
    } else {
      const position = calculateMenuPosition(messageId);
      setMenuPosition(position);
      setActiveMenu(messageId);
      setActiveEmojiPicker(null);
    }
  };

  const handleEdit = (msg: Message) => {
    setEditingMessage(msg._id || msg.id?.toString() || '');
    setEditText(msg.editedMessage || msg.message);
    setActiveMenu(null);
  };

  const handleSaveEdit = (messageId: string) => {
    if (onEditMessage && editText.trim() !== '') {
      onEditMessage(messageId, editText.trim());
      setEditingMessage(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setActiveMenu(null);
  };

  const handleForward = (msg: Message) => {
    localStorage.setItem('forwardedMessage', JSON.stringify({
      text: msg.message,
      sender: msg.sender,
    }));
    setActiveMenu(null);
    // Dispatch event to show toast
    window.dispatchEvent(new CustomEvent('showToast', { detail: 'Message ready to forward!' }));
  };

  const handleMention = (username: string) => {
    const event = new CustomEvent('addMention', { detail: username });
    window.dispatchEvent(event);
    setActiveMenu(null);
  };

  // Enhanced scroll to message with highlight animation
  const scrollToMessage = useCallback((messageId: string, highlight: boolean = true) => {
    const messageEl = messageRefs.current.get(messageId);
    if (messageEl && chatRef.current) {
      const wrapper = messageEl.parentElement;
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (highlight) {
        setTempHighlight(messageId);
        if (wrapper) {
          wrapper.classList.add('animate-message-highlight');
          wrapper.classList.add('animate-message-highlight-pulse');
        }

        setTimeout(() => {
          if (wrapper) {
            wrapper.classList.remove('animate-message-highlight');
            wrapper.classList.remove('animate-message-highlight-pulse');
          }
          setTempHighlight(null);
        }, 3000);
      }
    }
  }, []);

  // Expose scrollToMessage via callback
  useEffect(() => {
    if (onJumpToMessage) {
      const handleJump = (e: CustomEvent) => {
        scrollToMessage(e.detail, true);
      };
      window.addEventListener('jumpToMessage', handleJump as EventListener);
      return () => window.removeEventListener('jumpToMessage', handleJump as EventListener);
    }
  }, [onJumpToMessage, scrollToMessage]);

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDateSeparator = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg?: Message): boolean => {
    const currentDate = currentMsg.createdAt || currentMsg.timestamp;
    const prevDate = prevMsg?.createdAt || prevMsg?.timestamp;
    if (!currentDate) return false;
    if (!prevDate) return true;

    const d1 = new Date(currentDate);
    const d2 = new Date(prevDate);
    return d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate();
  };

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  const hasUserReacted = (msg: Message, emoji: string): boolean => {
    return msg.reactions?.some(r => r.emoji === emoji && r.users.includes(currentUser)) || false;
  };

  const getMessageId = (msg: Message): string => {
    return msg._id || msg.id?.toString() || '';
  };

  const isUserOnline = (username: string): boolean => {
    return onlineUsers.includes(username);
  };

  const getUserStatus = (username: string): string => {
    const user = users.find(u => u.name === username);
    return user?.status || (isUserOnline(username) ? 'online' : 'offline');
  };

  const getUserAvatar = (username: string): string | undefined => {
    const user = users.find(u => u.name === username);
    return user?.avatar;
  };

  const getUserRole = (username: string): string | undefined => {
    const user = users.find(u => u.name === username);
    return user?.role;
  };

  const getUserDisplayName = (username: string): string => {
    const user = users.find(u => u.name === username);
    return user?.displayName || username;
  };

  const getRepliedMessage = (replyToId: string | null): Message | null => {
    if (!replyToId) return null;
    return messages.find(m => (m._id || m.id?.toString()) === replyToId) || null;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getHierarchyWeight = (role?: string, globalRole?: string) => {
    if (globalRole === 'owner') return 100;
    if (globalRole === 'admin') return 80;
    if (globalRole === 'global_mod') return 60;
    if (role === 'owner') return 40;
    if (role === 'moderator') return 20;
    return 0;
  };

  const getTargetUser = (targetUsername: string) => {
    return users.find((u) => u.name === targetUsername);
  };

  const canModerate = (targetUser: string) => {
    if (targetUser === currentUser) return false;

    const target = getTargetUser(targetUser);
    const targetWeight = getHierarchyWeight(target?.role, target?.globalRole);
    const myWeight = getHierarchyWeight(currentUserRole, currentUserGlobalRole);

    return myWeight > targetWeight && myWeight > 0;
  };

  const canPromote = (targetUser: string) => {
    if (targetUser === currentUser) return false;
    // Platform owner (globalRole 'owner') or global admins/mods or room owner can promote
    return (
      currentUserGlobalRole === 'owner' ||
      currentUserRole === 'owner' ||
      currentUserGlobalRole === 'admin' ||
      currentUserGlobalRole === 'global_mod'
    );
  };

  const renderMessageContent = (msg: Message, isMe: boolean = false) => {
    const msgId = getMessageId(msg);
    const isEditing = editingMessage === msgId;

    if (isEditing) {
      return (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveEdit(msgId)}
              className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // 1. Define your backend base URL at the top of ChatWindow.tsx or in a config file


    // ... later in your render logic ...

    if (msg.messageType === 'image' && msg.fileData) {
      return (
        <div className="space-y-2">
          <img
            src={msg.fileData.url}
            alt={msg.fileData.originalName}
            crossOrigin="anonymous"
            className="max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxWidth: 'min(384px, 100%)' }}
            onClick={() => window.open(msg.fileData?.url, '_blank')}
            onError={(e) => {
              console.error('Image load error:', msg.fileData?.url);
              // Fallback: try to reload without CORS
              const img = e.currentTarget;
              img.crossOrigin = '';
              img.src = msg.fileData?.url + '?retry=' + Date.now();
            }}
          />
          <p className="text-xs opacity-75" style={{ color: 'var(--text-muted)' }}>
            {msg.fileData.originalName}
          </p>
        </div>
      );
    }

    if (msg.messageType === 'gif' || msg.messageType === 'sticker') {
      return (
        <div className="space-y-2">
          <img
            src={msg.message}
            alt={msg.messageType === 'gif' ? 'GIF' : 'Sticker'}
            crossOrigin="anonymous"
            className="max-h-64 rounded-lg bg-transparent"
            style={{ maxWidth: 'min(384px, 100%)' }}
          />
        </div>
      );
    }

    if (msg.messageType === 'file' && msg.fileData) {
      return (
        <div
          className="flex items-center gap-3 p-3 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <File className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {msg.fileData.originalName}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatFileSize(msg.fileData.size)}
            </p>
          </div>
          <a
            href={msg.fileData.url}
            download={msg.fileData.originalName}
            className="p-2 rounded-full transition-colors"
            style={{ '--hover-bg': 'var(--bg-tertiary)' } as React.CSSProperties}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Download className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
          </a>
        </div>
      );
    }

    if (msg.messageType === 'voice' && msg.fileData) {
      return (
        <div
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <audio
            controls
            className="flex-1"
            preload="metadata"
            crossOrigin="anonymous"
          >
            <source src={msg.fileData.url} type={msg.fileData.mimetype || 'audio/webm'} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    let displayMessage = msg.editedMessage || msg.message;
    if (msg.mentions && msg.mentions.length > 0) {
      msg.mentions.forEach(mention => {
        const mentionRegex = new RegExp(`@${mention}\\b`, 'gi');
        const mentionClass = isMe ? 'mention-highlight-me' : 'mention-highlight';
        displayMessage = displayMessage.replace(
          mentionRegex,
          `<span class="${mentionClass}">@${mention}</span>`
        );
      });
    }

    // Extract URLs for LinkPreviews
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = (msg.editedMessage || msg.message).match(urlRegex) || [];
    const uniqueUrls = [...new Set(urls)].slice(0, 3); // Max 3 previews to prevent spam

    return (
      <div>
        <p
          className={`message-text text-[15px] leading-relaxed ${isMe ? 'text-white' : ''}`}
          style={!isMe ? { color: 'var(--text-primary)' } : {}}
          dangerouslySetInnerHTML={{ __html: displayMessage }}
        />
        {msg.isEdited && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            (edited)
          </p>
        )}

        {/* Render Link Previews below the text */}
        {uniqueUrls.length > 0 && (
          <div className="mt-2 space-y-2">
            {uniqueUrls.map((url, i) => (
              <LinkPreview key={i} url={url} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div
          className="border-b px-6 py-2 shrink-0 pinned-bar transition-all duration-300"
        >
          <button
            onClick={() => setShowPinned(!showPinned)}
            className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
          >
            <Pin className="w-4 h-4" />
            <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
          </button>
          {showPinned && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {pinnedMessages.map(msg => (
                <div
                  key={getMessageId(msg)}
                  className="text-sm p-2 rounded cursor-pointer transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                  onClick={() => scrollToMessage(getMessageId(msg))}
                >
                  <span className="font-medium">{msg.sender}:</span>
                  <span className="ml-1 opacity-80">{msg.message.substring(0, 60)}...</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Container */}
      <div
        ref={chatRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-6"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full space-y-3"
            style={{ color: 'var(--text-muted)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <MessageSquare className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender === currentUser;
            const msgId = getMessageId(msg);
            const showActions = hoveredMessage === msgId || activeMenu === msgId || activeEmojiPicker === msgId;
            const isUnreadStart = msgId === unreadMessageId;
            const repliedMsg = getRepliedMessage(msg.replyTo);
            const isHighlighted = msgId === highlightedMessageId || msgId === tempHighlight;
            const userStatus = getUserStatus(msg.sender);
            const userAvatar = getUserAvatar(msg.sender);
            const prevMsg = index > 0 ? messages[index - 1] : undefined;


            return (
              <React.Fragment key={msgId}>
                {/* Date Separator */}
                {shouldShowDateSeparator(msg, index > 0 ? messages[index - 1] : undefined) && (
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full select-none"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {formatDateSeparator(msg.createdAt || msg.timestamp)}
                    </span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
                  </div>
                )}
                {/* Unread Messages Divider */}
                {isUnreadStart && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-red-400"></div>
                    <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
                      New Messages
                    </span>
                    <div className="flex-1 h-px bg-red-400"></div>
                  </div>
                )}

                <div
                  className={`w-full rounded-lg ${isHighlighted ? 'animate-message-highlight animate-message-highlight-pulse' : ''}`}
                  onMouseEnter={() => setHoveredMessage(msgId)}
                  onMouseLeave={() => {
                    if (activeMenu !== msgId && activeEmojiPicker !== msgId) {
                      setHoveredMessage(null);
                    }
                  }}
                >
                  <div
                    ref={(el: HTMLDivElement | null) => {
                      if (el) {
                        messageRefs.current.set(msgId, el);
                      } else {
                        messageRefs.current.delete(msgId);
                      }
                      return;
                    }}
                    className={`group flex items-start gap-3 max-w-[75%] ${isMe ? 'flex-row-reverse ml-auto' : 'flex-row'}`}
                    data-message-id={msgId}
                  >
                  {/* Avatar */}
                  {!isMe && (
                    <div
                      className="relative shrink-0 cursor-pointer"
                      onClick={() => window.dispatchEvent(new CustomEvent('viewProfileInSidebar', { detail: msg.sender }))}
                    >
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt={msg.sender}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: 'var(--accent-color)' }}
                        >
                          {msg.sender.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Status Indicator */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 rounded-full ${getStatusColor(userStatus)}`}
                        style={{ borderColor: 'var(--bg-primary)' }}
                      />
                    </div>
                  )}

                  <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'} max-w-full`}>
                    {/* Reply Preview */}
                    {repliedMsg && (
                      <div
                        className={`mb-1.5 px-3 py-2 rounded-lg cursor-pointer text-sm border-l-4 transition-all hover:opacity-80 reply-preview`}
                        onClick={() => scrollToMessage(getMessageId(repliedMsg))}
                      >
                        <div className="flex items-start gap-2">
                          <Reply className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                              {repliedMsg.sender}
                            </div>
                            <div className="text-sm leading-relaxed break-words line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                              {repliedMsg.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="relative min-w-0 max-w-full">
                      {/* Message Actions & Menus */}
                      {showActions && (
                        <div
                          className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 flex items-center space-x-1 rounded-full shadow-lg border p-1 z-[60] transition-all`}
                          style={{
                            backgroundColor: 'var(--menu-bg)',
                            borderColor: 'var(--border-color)'
                          }}
                        >
                          <button
                            onClick={(e) => handleMenuToggle(msgId, e)}
                            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover-bg-menu"
                            style={{
                              color: 'var(--text-muted)',
                            }}
                            aria-label="Message options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Emoji Picker */}
                          {activeEmojiPicker === msgId && (
                            <div
                              className={`absolute ${isMe ? 'right-0' : 'left-0'} ${menuPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] shadow-2xl rounded-xl overflow-hidden`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <EmojiPicker
                                onEmojiClick={(emojiData: EmojiClickData) => {
                                  onReact(msgId, emojiData.emoji, 'add');
                                  setActiveEmojiPicker(null);
                                }}
                                width={300}
                                height={350}
                                previewConfig={{ showPreview: false }}
                                skinTonesDisabled
                                theme={darkMode ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                              />
                            </div>
                          )}

                          {/* Message Menu */}
                          {activeMenu === msgId && (
                            <div
                              className={`absolute ${isMe ? 'right-0' : 'left-0'} ${menuPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} rounded-xl shadow-xl py-1.5 min-w-[180px] z-[60] max-h-[400px] overflow-y-auto theme-menu border`}
                              style={{
                                backgroundColor: 'var(--menu-bg)',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Quick Reactions */}
                              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                <div className="flex justify-between">
                                  {quickReactions.map((emoji) => {
                                    const hasReacted = hasUserReacted(msg, emoji);
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => {
                                          onReact(msgId, emoji, hasReacted ? 'remove' : 'add');
                                          setActiveMenu(null);
                                        }}
                                        className={`text-lg hover:scale-110 transition-transform ${hasReacted ? 'scale-110 opacity-100' : 'opacity-70'}`}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Menu Items */}
                              <button
                                onClick={() => {
                                  setActiveEmojiPicker(msgId);
                                  setActiveMenu(null);
                                }}
                                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Smile className="w-4 h-4" />
                                More reactions
                              </button>

                              <button
                                onClick={() => {
                                  onReplyToMessage?.(msg);
                                  setActiveMenu(null);
                                }}
                                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Reply className="w-4 h-4" />
                                Reply
                              </button>

                              <button
                                onClick={() => handleCopyText(msg.message)}
                                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Copy className="w-4 h-4" />
                                Copy text
                              </button>

                              <button
                                onClick={() => handleForward(msg)}
                                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Forward className="w-4 h-4" />
                                Forward
                              </button>

                              {!isMe && (
                                <button
                                  onClick={() => handleMention(msg.sender)}
                                  className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  <AtSign className="w-4 h-4" />
                                  Mention {msg.sender}
                                </button>
                              )}

                              {/* Moderation Actions */}
                              {!isMe && canModerate(msg.sender) && (
                                <>
                                  <div className="border-t my-1" style={{ borderColor: 'var(--border-color)' }} />
                                  <button
                                    onClick={() => {
                                      onKickUser?.(msg.sender);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                  >
                                    <UserX className="w-4 h-4" />
                                    Kick {msg.sender}
                                  </button>

                                  {/* Only show 'Room Ban' if NOT in 'generalchat' */}
                                  {roomName !== 'general chat' && (
                                    <button
                                      onClick={() => {
                                        onBanUser?.(msg.sender);
                                        setActiveMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <Ban className="w-4 h-4" />
                                      Room Ban {msg.sender}
                                    </button>
                                  )}

                                  {/* Platform Ban -> only for global mods/admins */}
                                  {(currentUserGlobalRole === 'admin' || currentUserGlobalRole === 'global_mod' || currentUserGlobalRole === 'owner') && (
                                    <button
                                      onClick={() => {
                                        if (onPlatformBanUser) {
                                          onPlatformBanUser(msg.sender);
                                        }
                                        setActiveMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold"
                                    >
                                      <Ban className="w-4 h-4" />
                                      Platform Ban {msg.sender}
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Promotion Actions */}
                              {!isMe && canPromote(msg.sender) && (
                                <>
                                  <div className="border-t my-1" style={{ borderColor: 'var(--border-color)' }} />
                                  {getUserRole(msg.sender) !== 'admin' && (currentUserGlobalRole === 'owner' || currentUserGlobalRole === 'admin') && (
                                    <button
                                      onClick={() => {
                                        onPromoteUser?.(msg.sender, 'admin');
                                        setActiveMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                    >
                                      <Shield className="w-4 h-4" />
                                      Promote to Admin
                                    </button>
                                  )}
                                  {getUserRole(msg.sender) !== 'moderator' && getUserRole(msg.sender) !== 'admin' && (
                                    <button
                                      onClick={() => {
                                        onPromoteUser?.(msg.sender, 'moderator');
                                        setActiveMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                      Promote to Mod
                                    </button>
                                  )}
                                  {(getUserRole(msg.sender) === 'moderator' || getUserRole(msg.sender) === 'admin') && (
                                    <button
                                      onClick={() => {
                                        onPromoteUser?.(msg.sender, 'member');
                                        setActiveMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20"
                                    >
                                      <UserX className="w-4 h-4" />
                                      Remove Mod Status
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Edit (own messages only) */}
                              {isMe && msg.messageType === 'text' && (
                                <button
                                  onClick={() => handleEdit(msg)}
                                  className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                              )}

                              {/* Pin/Unpin */}
                              {msg.isPinned ? (
                                <button
                                  onClick={() => {
                                    onUnpinMessage?.(msgId);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  <PinOff className="w-4 h-4" />
                                  Unpin
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    onPinMessage?.(msgId);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  <Pin className="w-4 h-4" />
                                  Pin
                                </button>
                              )}

                              {/* Report */}
                              <button
                                onClick={() => {
                                  onReportMessage?.(msgId);
                                  setActiveMenu(null);
                                }}
                                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              >
                                <Flag className="w-4 h-4" />
                                Report
                              </button>

                              {/* Delete */}
                              {(isMe || canModerate(msg.sender)) && (
                                <button
                                  onClick={() => {
                                    onDeleteMessage?.(msgId);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              )}

                              {!isMe && canModerate(msg.sender) && (
                                <>
                                  <div className="border-t my-1" style={{ borderColor: 'var(--border-color)' }} />
                                  {/* Mute */}
                                  <button
                                    onClick={() => {
                                      onMuteUser?.(msg.sender);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                  >
                                    <BellOff className="w-4 h-4" />
                                    Mute {msg.sender}
                                  </button>

                                  {/* Unmute */}
                                  <button
                                    onClick={() => {
                                      onUnmuteUser?.(msg.sender);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                  >
                                    <Bell className="w-4 h-4" />
                                    Unmute {msg.sender}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`px-4 py-2.5 rounded-2xl relative min-w-0 max-w-full transition-all ${isMe
                          ? 'bg-blue-400 dark:bg-blue-500 text-white rounded-br-md'
                          : 'rounded-bl-md shadow-sm'
                          } ${msg.isReported ? 'opacity-60' : ''} ${msg.isPinned ? 'ring-2 ring-amber-400' : ''}`}
                        style={!isMe ? {
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)'
                        } : {}}
                      >
                        {msg.isPinned && (
                          <Pin className="w-3 h-3 absolute -top-1 -right-1 text-amber-500" />
                        )}

                        {!isMe && (
                          <p
                            className="text-xs font-medium mb-1 break-words"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {getUserDisplayName(msg.sender)}
                          </p>
                        )}

                        {renderMessageContent(msg, isMe)}

                        {/* Timestamp & Read Status */}
                        <div className={`flex items-center justify-end mt-1 space-x-1 ${isMe ? 'text-blue-100' : ''}`}
                          style={!isMe ? { color: 'var(--text-muted)' } : {}}
                        >
                          <span className="text-[11px]">{formatTime(msg.timestamp || msg.createdAt)}</span>
                          {isMe && msg.readBy && (
                            msg.readBy.length > 1 ? (
                              <CheckCheck className="w-3.5 h-3.5" style={{ color: '#4ADE80' }} />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )
                          )}
                        </div>
                      </div>
                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {msg.reactions.map((reaction, i) => {
                            const userHasReacted = reaction.users.includes(currentUser);
                            return (
                              <button
                                key={i}
                                onClick={() => onReact(msgId, reaction.emoji, userHasReacted ? 'remove' : 'add')}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-all hover:scale-105 ${userHasReacted
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 shadow-sm'
                                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                style={!userHasReacted ? {
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--text-secondary)'
                                } : {}}
                                title={reaction.users.join(', ')}
                              >
                                <span>{reaction.emoji}</span>
                                {reaction.users.length > 1 && (
                                  <span className="text-xs font-medium">{reaction.users.length}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;