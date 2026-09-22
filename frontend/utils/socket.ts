// frontend/utils/socket.ts - HTTP-ONLY COOKIE AUTH
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  transports: ['websocket', 'polling'],
});

export const connectSocket = () => {
  console.log('🔗 Connecting socket with cookies...');
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
  startTokenRefreshInterval();
  return true;
};

export const isAuthenticated = (): boolean => {
  // Username stored for UI; real auth is verified via httpOnly cookie on server
  return !!localStorage.getItem('username');
};

export const getStoredUsername = (): string | null => {
  return localStorage.getItem('username');
};

export const disconnectSocket = () => {
  stopTokenRefreshInterval();
  socket.disconnect();
};

export const setSocketToken = (token?: string) => {
  startTokenRefreshInterval();
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  } else {
    socket.connect();
  }
};

let isRefreshing = false;

export const handleAuthExpiry = async () => {
  if (isRefreshing) {
    console.log('🔄 Token refresh already in progress, skipping duplicate call');
    return true;
  }

  isRefreshing = true;
  console.log('🔄 Attempting to refresh access token via httpOnly cookie...');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (response.ok) {
      console.log('✅ Token refreshed successfully via cookie');

      // Reconnect socket with refreshed cookie
      socket.disconnect();
      socket.connect();

      isRefreshing = false;
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Token refresh endpoint returned error:', response.status, errorData);
    }
  } catch (err) {
    console.error('❌ Token refresh fetch failed:', err);
  }

  isRefreshing = false;
  return false;
};

let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

export const startTokenRefreshInterval = () => {
  stopTokenRefreshInterval();

  // Refresh every 12 minutes (token expires in 15m, so refresh 3 min early)
  tokenRefreshInterval = setInterval(async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        console.log('🔄 Token proactively refreshed via httpOnly cookie');
      }
    } catch (err) {
      console.error('❌ Proactive token refresh failed:', err);
    }
  }, 12 * 60 * 1000); // 12 minutes
};

export const stopTokenRefreshInterval = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};

export default socket;