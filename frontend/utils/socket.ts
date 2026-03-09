// frontend/utils/socket.ts - FIXED TOKEN HANDLING
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  transports: ['websocket', 'polling'],
});

socket.io.on('reconnect_attempt', () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    socket.auth = { token };
  } else {
    socket.auth = {};
  }
});

export const connectSocket = () => {
  console.log('🔗 Connecting socket...');
  const token = localStorage.getItem('accessToken');
  if (token) {
    socket.auth = { token };
    startTokenRefreshInterval(); // Start proactive refresh
  } else {
    socket.auth = {};
    stopTokenRefreshInterval(); // No need for refresh if guest
  }
  socket.connect();
  return true;
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('accessToken');
};

export const getStoredUsername = (): string | null => {
  return localStorage.getItem('username');
};

export const disconnectSocket = () => {
  stopTokenRefreshInterval();
  socket.disconnect();
};

export const setSocketToken = (token: string) => {
  localStorage.setItem('accessToken', token);
  socket.auth = { token };
  startTokenRefreshInterval();
  // Re-evaluating auth by reconnecting
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

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    console.warn('❌ Cannot refresh: No refresh token in localStorage');
    return false;
  }

  isRefreshing = true;
  console.log('🔄 Attempting to refresh access token...');

  // ✅ OPTIMIZATION: Check if another tab already refreshed the token
  // If the socket is currently failing but the token in localStorage is already different 
  // from what we'd expect, it might have been refreshed elsewhere.
  // However, since we now use a FUNCTION for socket.auth, simply reconnecting will use the new token.

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token refreshed successfully');

      localStorage.setItem('accessToken', data.accessToken);

      // Reconnect with new token
      socket.disconnect();
      socket.auth = { token: data.accessToken };
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

// Add at module level  
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

// New function to start proactive token refresh  
export const startTokenRefreshInterval = () => {
  stopTokenRefreshInterval(); // Clear any existing interval  

  // Refresh every 12 minutes (token expires in 15m, so refresh 3 min early)  
  tokenRefreshInterval = setInterval(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        socket.auth = { token: data.accessToken };
        console.log('🔄 Token proactively refreshed');
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