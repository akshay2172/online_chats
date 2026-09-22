// backend/middleware/socket-auth.middleware.ts
import 'dotenv/config';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { createClient } from 'redis';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

export interface AuthenticatedSocket extends Socket {
    data: {
        user?: {
            userId: string;
            username: string | null;
            type: 'access' | 'guest';
        };
        authError?: string; // Optional: lets the gateway know auth failed
    };
}

function parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((cookies, item) => {
        const [name, ...val] = item.trim().split('=');
        if (name && val) {
            cookies[name] = decodeURIComponent(val.join('='));
        }
        return cookies;
    }, {} as Record<string, string>);
}

export const socketAuthMiddleware = (socket: AuthenticatedSocket, next: Function) => {
    try {
        // Get token from cookie header first, then fallback to auth/headers/query
        const cookies = parseCookies(socket.handshake.headers.cookie);
        let token =
            cookies.accessToken ||
            socket.handshake.auth?.token ||
            socket.handshake.headers.authorization?.split(' ')[1] ||
            (socket.handshake.query?.token as string);

        // Catch stringified nulls/undefined often sent by frontend local storage
        if (token === 'null' || token === 'undefined' || token === '') {
            token = null;
        }

        if (!token) {
            console.log(`👤 Guest user connecting without token (${socket.id}) - socket-auth.middleware.ts:50`);
            socket.data.user = { userId: '', username: null, type: 'guest' };
            return next(); // ✅ Allow connection
        }
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Check token type
        if (decoded.type !== 'access') {
            console.warn(`⚠️ Invalid token type for ${socket.id}. Downgrading to guest. - socket-auth.middleware.ts:59`);
            socket.data.user = { userId: '', username: null, type: 'guest' };
            socket.data.authError = 'Invalid token type';
            return next(); // ✅ Downgrade and allow connection
        }

        // Attach user info to socket
        socket.data.user = {
            userId: decoded.userId,
            username: decoded.username,
            type: 'access',
        };

        console.log(`✅ User authenticated: ${decoded.username} (${socket.id}) - socket-auth.middleware.ts:72`);
        next();
    } catch (error: any) {
        // --- Downgrade to Guest instead of rejecting connection ---
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            console.log(`⚠️ Token verification failed (${error.message}). Downgrading to guest mode for ${socket.id} - socket-auth.middleware.ts:77`);

            socket.data.user = { userId: '', username: null, type: 'guest' };
            socket.data.authError = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';

            return next(); // ✅ Allow connection as a guest
        }

        console.error('Auth middleware critical error: - socket-auth.middleware.ts:85', error);
        next(new Error('Authentication error'));
    }
};


// Redis-backed Rate limiting middleware
const rateLimits: Map<string, number[]> = new Map();
const WINDOW_MS = 60000; // 1 minute
const MAX_CONNECTIONS = 20; // 20 connection attempts per minute per IP

let redisRateClient: any = null;
try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisRateClient = createClient({ url: redisUrl });
    redisRateClient.on('error', () => {}); // Silent catch for optional redis
    redisRateClient.connect().catch(() => {});
} catch {
    // Redis connection is optional
}

export const socketRateLimitMiddleware = async (socket: Socket, next: Function) => {
    const ip = socket.handshake.address || '127.0.0.1';
    const now = Date.now();

    if (redisRateClient && redisRateClient.isOpen) {
        try {
            const key = `socket_rate_limit:${ip}`;
            const multi = redisRateClient.multi();
            multi.zRemRangeByScore(key, 0, now - WINDOW_MS);
            multi.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
            multi.zCard(key);
            multi.expire(key, 60);
            const results = await multi.exec();
            const count = results ? (results[2] as number) : 0;
            if (count > MAX_CONNECTIONS) {
                return next(new Error('Rate limit: Too many connection attempts'));
            }
            return next();
        } catch {
            // Fall through to in-memory on redis failure
        }
    }

    const userAttempts = rateLimits.get(ip) || [];
    const recentAttempts = userAttempts.filter(time => now - time < WINDOW_MS);

    if (recentAttempts.length >= MAX_CONNECTIONS) {
        return next(new Error('Rate limit: Too many connection attempts'));
    }

    recentAttempts.push(now);
    rateLimits.set(ip, recentAttempts);

    next();
};

// IP ban middleware
export class IPBanList {
    private static bannedIPs: Set<string> = new Set();
    private static suspiciousIPs: Map<string, number> = new Map();

    static banIP(ip: string, duration?: number): void {
        this.bannedIPs.add(ip);
        console.warn(`🚫 Banned IP: ${ip} - socket-auth.middleware.ts:149`);

        if (duration) {
            setTimeout(() => {
                this.bannedIPs.delete(ip);
                console.log(`✅ Unbanned IP: ${ip} - socket-auth.middleware.ts:154`);
            }, duration);
        }
    }

    static isBanned(ip: string): boolean {
        return this.bannedIPs.has(ip);
    }

    static markSuspicious(ip: string): void {
        const count = (this.suspiciousIPs.get(ip) || 0) + 1;
        this.suspiciousIPs.set(ip, count);

        // Auto-ban after 3 suspicious activities
        if (count >= 3) {
            this.banIP(ip, 60 * 60 * 1000); // Ban for 1 hour
        }
    }

    static middleware(socket: Socket, next: Function): void {
        const ip = socket.handshake.address;

        if (IPBanList.isBanned(ip)) {
            return next(new Error('Your IP has been banned'));
        }

        next();
    }
}