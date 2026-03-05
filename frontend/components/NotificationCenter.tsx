// frontend/components/NotificationCenter.tsx
// Based on Product Decisions:
// - Types: Mentions + Room Invites + System Alerts
// - Persistence: MongoDB (survives page reloads)
// - UI: Dropdown panel
import { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Trash2, 
  AtSign, 
  Mail, 
  Shield, 
  AlertCircle,
  UserX,
  Crown
} from 'lucide-react';
import { useDarkMode } from '../pages/_app';

interface Notification {
  _id: string;
  type: 'mention' | 'room_invite' | 'kicked' | 'banned' | 'unbanned' | 'promoted' | 'system_error';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

interface Props {
  username: string;
  onNotificationClick?: (notification: Notification) => void;
  inline?: boolean; // Render directly into Sidebar without dropdown wrapper
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'mention':
      return <AtSign className="w-5 h-5 text-blue-500" />;
    case 'room_invite':
      return <Mail className="w-5 h-5 text-green-500" />;
    case 'kicked':
      return <UserX className="w-5 h-5 text-orange-500" />;
    case 'banned':
      return <Shield className="w-5 h-5 text-red-500" />;
    case 'promoted':
      return <Crown className="w-5 h-5 text-yellow-500" />;
    case 'system_error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
};

export default function NotificationCenter({ username, onNotificationClick, inline = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { darkMode } = useDarkMode();

  // Fetch notifications
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/notifications/${username}`);
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load notifications on mount and when username changes
  useEffect(() => {
    if (username) {
      fetchNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [username]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/notifications/${username}/read-all`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification._id);
    
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    
    // Navigate to action URL if available
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    
    setIsOpen(false);
  };

  // Shared notification panel content (used in both inline and dropdown modes)
  const notificationPanel = (
    <div
      className="rounded-lg shadow-2xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)'
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b flex items-center justify-between sticky top-0 z-10"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span
              className="px-2 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'white'
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="p-1.5 rounded-lg transition-colors"
              style={{ '--hover-bg': 'var(--bg-secondary)' } as React.CSSProperties}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}

          {/* Only show close button in dropdown mode */}
          {!inline && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ '--hover-bg': 'var(--bg-secondary)' } as React.CSSProperties}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto max-h-[400px]">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No notifications</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              You're all caught up!
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {notifications.map(notification => (
              <div
                key={notification._id}
                className="group relative"
              >
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full p-4 text-left transition-colors"
                  style={{
                    backgroundColor: notification.isRead ? 'transparent' : 'var(--bg-secondary)',
                    '--hover-bg': 'var(--bg-tertiary)'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = notification.isRead ? 'transparent' : 'var(--bg-secondary)';
                  }}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {notification.title}
                      </p>
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {notification.message}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread Indicator */}
                    {!notification.isRead && (
                      <div
                        className="shrink-0 w-2 h-2 rounded-full mt-2"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      />
                    )}
                  </div>
                </button>

                {/* Delete Button (on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification._id);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    '--hover-bg': 'rgba(239, 68, 68, 0.1)'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Inline mode: render the panel directly (e.g. embedded in Sidebar)
  if (inline) return notificationPanel;

  // Default mode: bell button + dropdown
  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-colors"
        style={{
          backgroundColor: isOpen ? 'var(--bg-secondary)' : 'transparent',
          '--hover-bg': 'var(--bg-secondary)'
        } as React.CSSProperties}
        onMouseEnter={(e) => !isOpen && (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
        onMouseLeave={(e) => !isOpen && (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Bell className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Positioned panel */}
          <div className="absolute right-0 mt-2 w-96 max-h-[500px] z-50">
            {notificationPanel}
          </div>
        </>
      )}
    </div>
  );
}