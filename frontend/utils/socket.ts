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

export const connectSocket = () => {
  // ✅ FIX: Use consistent token key
  const token = localStorage.getItem('accessToken');

  // ✅ FIX: Allow guest connections without token
  if (token) {
    socket.auth = { token };
    console.log('🔐 Connecting with authentication token - socket.ts:23');
  } else {
    console.log('👤 Connecting as guest (no token) - socket.ts:25');
    // Clear any previous auth
    socket.auth = {};
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
  socket.disconnect();
};

export const setSocketToken = (token: string) => {
  socket.auth = { token };
  localStorage.setItem('accessToken', token);
  if (!socket.connected) {
    socket.connect();
  }
};

export const handleAuthExpiry = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      // Reconnect with new token
      socket.disconnect();
      socket.auth = { token: data.accessToken };
      socket.connect();
      return true;
    }
  } catch (err) {
    console.error('Token refresh failed:', err);
  }

  return false;
};

export default socket;