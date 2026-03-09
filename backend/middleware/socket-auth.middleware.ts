// backend/middleware/socket-auth.middleware.ts
import 'dotenv/config';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

export interface AuthenticatedSocket extends Socket {
    data: {
        user?: {
            userId: string;
            username: string;
            type: string;
        };
        authError?: string; // Optional: lets the gateway know auth failed
    };
}

export const socketAuthMiddleware = (socket: AuthenticatedSocket, next: Function) => {
    try {
        // Get token from handshake
        let token =
            socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1] ||
            socket.handshake.query.token;

        // Catch stringified nulls/undefined often sent by frontend local storage
        if (token === 'null' || token === 'undefined' || token === '') {
            token = null;
        }

        if (!token) {
            console.log(`👤 Guest user connecting without token (${socket.id}) - socket-auth.middleware.ts:30`);
            socket.data.user = undefined; // No user data for guests
            return next(); // ✅ Allow connection
        }

        // Verify token
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Check token type
        if (decoded.type !== 'access') {
            console.warn(`⚠️ Invalid token type for ${socket.id}. Downgrading to guest. - socket-auth.middleware.ts:41`);
            socket.data.user = undefined;
            socket.data.authError = 'Invalid token type';
            return next(); // ✅ Downgrade and allow connection
        }

        // Attach user info to socket
        socket.data.user = {
            userId: decoded.userId,
            username: decoded.username,
            type: decoded.type,
        };

        console.log(`✅ User authenticated: ${decoded.username} (${socket.id}) - socket-auth.middleware.ts:54`);
        next();
    } catch (error: any) {
        // --- THE FIX: Downgrade to Guest instead of rejecting connection ---
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            console.log(`⚠️ Token verification failed (${error.message}). Downgrading to guest mode for ${socket.id} - socket-auth.middleware.ts:59`);

            // Wipe user data to enforce guest status
            socket.data.user = undefined;

            // Optionally store the error if your gateway logic wants to trigger a token refresh later
            socket.data.authError = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';

            return next(); // ✅ Allow connection as a guest
        }

        console.error('Auth middleware critical error: - socket-auth.middleware.ts:70', error);
        next(new Error('Authentication error'));
    }
};


// Rate limiting middleware
const rateLimits: Map<string, number[]> = new Map();
const WINDOW_MS = 60000; // 1 minute
const MAX_CONNECTIONS = 5; // 5 connections per minute per IP

export const socketRateLimitMiddleware = (socket: Socket, next: Function) => {
    const ip = socket.handshake.address;
    const now = Date.now();

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
        console.warn(`🚫 Banned IP: ${ip} - socket-auth.middleware.ts:107`);

        if (duration) {
            setTimeout(() => {
                this.bannedIPs.delete(ip);
                console.log(`✅ Unbanned IP: ${ip} - socket-auth.middleware.ts:112`);
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