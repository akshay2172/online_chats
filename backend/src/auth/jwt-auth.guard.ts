// backend/src/auth/jwt-auth.guard.ts
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader: string | undefined = request.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid Authorization header.');
        }

        const token = authHeader.slice(7); // strip "Bearer "
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new UnauthorizedException('Server misconfiguration: JWT_SECRET not set.');
        }

        try {
            const payload = jwt.verify(token, secret) as any;
            // Attach the decoded payload as req.user so controllers can read it
            request.user = {
                userId: payload.userId,
                username: payload.username,
                isOwner: payload.isOwner ?? false,
            };
            return true;
        } catch {
            throw new UnauthorizedException('Invalid or expired token.');
        }
    }
}
