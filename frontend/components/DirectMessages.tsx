// frontend/components/DirectMessages.tsx - FULL DM SYSTEM
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Search, X, User as UserIcon, MoreVertical, Trash2,
  ArrowLeft, Send, Paperclip, Image as ImageIcon, Loader2, Check, CheckCheck
} from 'lucide-react';
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
  createdAt: string;
}

interface Props {
  currentUser: string;
  conversations: DMConversation[];
  onStartDM: (username: string) => void;
  onSendDMMessage: (conversationId: string, message: string, receiver: string) => void;
  onDeleteDM: (conversationId: string) => void;
  onMarkDMAsRead: (conversationId: string) => void;
  onLoadDMMessages: (conversationId: string) => void;
  activeDMConversation: DMConversation | null;
  dmMessages: DMMsg[];
  onViewProfile?: (username: string) => void;
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

const formatMessageTime = (timeString: string) => {
  const date = new Date(timeString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function DirectMessages({
  currentUser, conversations, onStartDM, onSendDMMessage, onDeleteDM,
  onMarkDMAsRead, onLoadDMMessages, activeDMConversation, dmMessages,
  onViewProfile,
}: Props) {
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<DMConversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { darkMode } = useDarkMode();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // When activeDMConversation changes from parent (i.e., startDM was called), open it
  useEffect(() => {
    if (activeDMConversation && activeDMConversation._id && activeDMConversation.otherUser) {
      setActiveChat(activeDMConversation);
      onLoadDMMessages(activeDMConversation._id);
    }
  }, [activeDMConversation?._id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages]);

  // Mark as read when opening a chat
  useEffect(() => {
    if (activeChat && activeChat.unreadCount > 0) {
      onMarkDMAsRead(activeChat._id);
    }
  }, [activeChat?._id]);

  const openChat = (conv: DMConversation) => {
    setActiveChat(conv);
    onLoadDMMessages(conv._id);
    if (conv.unreadCount > 0) {
      onMarkDMAsRead(conv._id);
    }
  };

  const handleSend = () => {
    if (!messageText.trim() || !activeChat) return;
    setIsSending(true);
    onSendDMMessage(activeChat._id, messageText.trim(), activeChat.otherUser.username);
    setMessageText('');
    setTimeout(() => setIsSending(false), 200);
    inputRef.current?.focus();
  };

  const filteredConversations = conversations.filter((c) =>
    c.otherUser && (
      c.otherUser.username.toLowerCase().includes(search.toLowerCase()) ||
      c.otherUser.displayName?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // =================== CHAT VIEW ===================
  if (activeChat) {
    return (
      <div
        className="rounded-xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          height: '500px',
        }}
      >
        {/* Chat Header */}
        <div
          className="p-3 border-b flex items-center gap-3 shrink-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={() => setActiveChat(null)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="flex items-center gap-3 flex-1 cursor-pointer"
            onClick={() => onViewProfile?.(activeChat.otherUser.username)}
          >
            <div className="relative">
              {activeChat.otherUser.avatar ? (
                <img src={activeChat.otherUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                  <span className="text-white font-medium text-sm">{activeChat.otherUser.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{ backgroundColor: getStatusColor(activeChat.otherUser.status), borderColor: 'var(--bg-primary)' }}
              />
            </div>
            <div>
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {activeChat.otherUser.displayName || activeChat.otherUser.username}
              </span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {activeChat.otherUser.status === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {dmMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Say hello! 👋</p>
            </div>
          ) : (
            dmMessages.map((msg) => {
              const isMine = msg.sender === currentUser;
              return (
                <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                    style={{
                      backgroundColor: isMine ? 'var(--accent-color)' : 'var(--bg-primary)',
                      color: isMine ? 'white' : 'var(--text-primary)',
                    }}
                  >
                    {msg.replyToMessage && (
                      <div
                        className="text-xs mb-1.5 px-2 py-1 rounded border-l-2 opacity-80"
                        style={{
                          borderColor: isMine ? 'rgba(255,255,255,0.5)' : 'var(--accent-color)',
                          backgroundColor: isMine ? 'rgba(255,255,255,0.1)' : 'var(--bg-secondary)',
                        }}
                      >
                        <span className="font-medium">{msg.replyToMessage.sender}</span>
                        <p className="truncate">{msg.replyToMessage.message}</p>
                      </div>
                    )}
                    {msg.messageType === 'image' && msg.fileData?.url ? (
                      <img src={msg.fileData.url} alt="" className="rounded-lg max-w-full mb-1" style={{ maxHeight: '200px' }} />
                    ) : null}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] opacity-60">{formatMessageTime(msg.createdAt)}</span>
                      {isMine && (
                        msg.readAt ? (
                          <CheckCheck className="w-3 h-3" style={{ color: '#53BDEB' }} />
                        ) : msg.deliveredAt ? (
                          <CheckCheck className="w-3 h-3 opacity-50" />
                        ) : (
                          <Check className="w-3 h-3 opacity-40" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="p-3 border-t flex items-center gap-2 shrink-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <textarea
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none transition-all resize-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            className="p-2.5 rounded-full transition-all disabled:opacity-30"
            style={{
              backgroundColor: messageText.trim() ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: messageText.trim() ? 'white' : 'var(--text-muted)',
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =================== CONVERSATION LIST VIEW ===================
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)'
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Messages</h3>
        </div>
        {totalUnread > 0 && (
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
          >
            {totalUnread}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="p-3">
        <div
          className="flex items-center space-x-2 px-3 py-2 rounded-lg border"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="text-xs mt-1">Click on a user to start messaging</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filteredConversations.map((conv) => (
              <div key={conv._id} className="relative group">
                <button
                  onClick={() => openChat(conv)}
                  className="w-full p-3 rounded-xl flex items-center gap-3 transition-all"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {conv.otherUser.avatar ? (
                      <img src={conv.otherUser.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                        <span className="text-white font-semibold">{conv.otherUser.username.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                      style={{ backgroundColor: getStatusColor(conv.otherUser.status), borderColor: 'var(--bg-primary)' }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {conv.otherUser.displayName || conv.otherUser.username}
                      </span>
                      <span className="text-[11px] shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs truncate" style={{ color: conv.unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: conv.unreadCount > 0 ? '600' : '400' }}>
                        {conv.lastMessageSender === currentUser ? 'You: ' : ''}{conv.lastMessage || 'Start a conversation'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ml-2"
                          style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Menu button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(showMenu === conv._id ? null : conv._id);
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <MoreVertical className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </button>

                {/* Context Menu */}
                {showMenu === conv._id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
                    <div
                      className="absolute right-2 top-12 z-20 rounded-xl shadow-lg border py-1 min-w-[140px]"
                      style={{ backgroundColor: 'var(--menu-bg)', borderColor: 'var(--border-color)' }}
                    >
                      <button
                        onClick={() => { onDeleteDM(conv._id); setShowMenu(null); }}
                        className="w-full px-3 py-2 text-sm flex items-center gap-2 transition-colors text-red-500"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Chat</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}