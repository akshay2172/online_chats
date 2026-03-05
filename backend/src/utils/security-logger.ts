// backend/utils/security-logger.ts
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

export class SecurityLogger {
  private static logger: winston.Logger;

  static initialize(): void {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');

    // Configure transports
    const transports: winston.transport[] = [
      // Console transport (for development)
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        ),
      }),

      // Security log file (daily rotation)
      new DailyRotateFile({
        filename: path.join(logsDir, 'security-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        level: 'warn',
      }),

      // All logs file
      new DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
    ];

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
    });
  }

  // Authentication events
  static logAuthSuccess(username: string, ip: string, socketId: string): void {
    this.ensureInitialized();
    this.logger.info('Authentication successful', {
      type: 'auth_success',
      username,
      ip,
      socketId,
      timestamp: new Date().toISOString(),
    });
  }

  static logAuthFailure(username: string, ip: string, reason: string): void {
    this.ensureInitialized();
    this.logger.warn('Authentication failed', {
      type: 'auth_failure',
      username,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logTokenExpired(username: string, ip: string): void {
    this.ensureInitialized();
    this.logger.info('Token expired', {
      type: 'token_expired',
      username,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  // Security threats
  static logInjectionAttempt(username: string, ip: string, input: string, type: string): void {
    this.ensureInitialized();
    this.logger.warn('Injection attempt detected', {
      type: 'injection_attempt',
      username,
      ip,
      injectionType: type,
      input: input.substring(0, 100), // Log only first 100 chars
      timestamp: new Date().toISOString(),
    });
  }

  static logXSSAttempt(username: string, ip: string, input: string): void {
    this.ensureInitialized();
    this.logger.warn('XSS attempt detected', {
      type: 'xss_attempt',
      username,
      ip,
      input: input.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
  }

  static logSQLInjectionAttempt(username: string, ip: string, query: string): void {
    this.ensureInitialized();
    this.logger.warn('SQL injection attempt detected', {
      type: 'sql_injection_attempt',
      username,
      ip,
      query: query.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
  }

  // Rate limiting
  static logRateLimitExceeded(username: string, ip: string, endpoint?: string): void {
    this.ensureInitialized();
    this.logger.warn('Rate limit exceeded', {
      type: 'rate_limit_exceeded',
      username,
      ip,
      endpoint,
      timestamp: new Date().toISOString(),
    });
  }

  static logConnectionRateLimitExceeded(ip: string): void {
    this.ensureInitialized();
    this.logger.warn('Connection rate limit exceeded', {
      type: 'connection_rate_limit_exceeded',
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  // File operations
  static logFileUploadSuccess(username: string, filename: string, size: number, mimetype: string): void {
    this.ensureInitialized();
    this.logger.info('File uploaded successfully', {
      type: 'file_upload_success',
      username,
      filename,
      size,
      mimetype,
      timestamp: new Date().toISOString(),
    });
  }

  static logFileUploadFailure(username: string, filename: string, reason: string): void {
    this.ensureInitialized();
    this.logger.warn('File upload failed', {
      type: 'file_upload_failure',
      username,
      filename,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logSuspiciousFile(username: string, filename: string, reason: string): void {
    this.ensureInitialized();
    this.logger.warn('Suspicious file detected', {
      type: 'suspicious_file',
      username,
      filename,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // Content moderation
  static logProfanityDetected(username: string, messageId: string): void {
    this.ensureInitialized();
    this.logger.warn('Profanity detected', {
      type: 'profanity_detected',
      username,
      messageId,
      timestamp: new Date().toISOString(),
    });
  }

  static logSpamDetected(username: string, reason: string): void {
    this.ensureInitialized();
    this.logger.warn('Spam detected', {
      type: 'spam_detected',
      username,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logPhishingAttempt(username: string, content: string): void {
    this.ensureInitialized();
    this.logger.warn('Phishing attempt detected', {
      type: 'phishing_attempt',
      username,
      content: content.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
  }

  // Moderation actions
  static logUserKicked(moderator: string, username: string, room: string, reason?: string): void {
    this.ensureInitialized();
    this.logger.info('User kicked', {
      type: 'user_kicked',
      moderator,
      username,
      room,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logUserBanned(moderator: string, username: string, room: string, reason?: string): void {
    this.ensureInitialized();
    this.logger.warn('User banned', {
      type: 'user_banned',
      moderator,
      username,
      room,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logUserUnbanned(moderator: string, username: string, room: string): void {
    this.ensureInitialized();
    this.logger.info('User unbanned', {
      type: 'user_unbanned',
      moderator,
      username,
      room,
      timestamp: new Date().toISOString(),
    });
  }

  static logUserPromoted(moderator: string, username: string, room: string, role: string): void {
    this.ensureInitialized();
    this.logger.info('User promoted', {
      type: 'user_promoted',
      moderator,
      username,
      room,
      role,
      timestamp: new Date().toISOString(),
    });
  }

  // Suspicious activity
  static logSuspiciousActivity(username: string, ip: string, activity: string, details: any): void {
    this.ensureInitialized();
    this.logger.warn('Suspicious activity detected', {
      type: 'suspicious_activity',
      username,
      ip,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  static logMultipleFailedLogins(username: string, ip: string, attempts: number): void {
    this.ensureInitialized();
    this.logger.warn('Multiple failed login attempts', {
      type: 'multiple_failed_logins',
      username,
      ip,
      attempts,
      timestamp: new Date().toISOString(),
    });
  }

  static logIPBanned(ip: string, reason: string): void {
    this.ensureInitialized();
    this.logger.warn('IP banned', {
      type: 'ip_banned',
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // System events
  static logServerStart(): void {
    this.ensureInitialized();
    this.logger.info('Server started', {
      type: 'server_start',
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }

  static logServerShutdown(): void {
    this.ensureInitialized();
    this.logger.info('Server shutting down', {
      type: 'server_shutdown',
      timestamp: new Date().toISOString(),
    });
  }

  static logDatabaseConnected(): void {
    this.ensureInitialized();
    this.logger.info('Database connected', {
      type: 'database_connected',
      timestamp: new Date().toISOString(),
    });
  }

  static logDatabaseError(error: Error): void {
    this.ensureInitialized();
    this.logger.error('Database error', {
      type: 'database_error',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }

  // Error logging
  static logError(error: Error, context?: any): void {
    this.ensureInitialized();
    this.logger.error('Application error', {
      type: 'application_error',
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // Helper method to ensure logger is initialized
  private static ensureInitialized(): void {
    if (!this.logger) {
      this.initialize();
    }
  }

  // Get logger instance (for custom logging)
  static getLogger(): winston.Logger {
    this.ensureInitialized();
    return this.logger;
  }

  // Cleanup old logs
  static async cleanupLogs(daysToKeep: number = 30): Promise<void> {
    // This is handled by DailyRotateFile maxFiles option
    this.logger.info('Log cleanup configured', {
      type: 'log_cleanup',
      daysToKeep,
      timestamp: new Date().toISOString(),
    });
  }
}

// Initialize logger on module load
SecurityLogger.initialize();

// Shutdown handler
process.on('SIGINT', () => {
  SecurityLogger.logServerShutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  SecurityLogger.logServerShutdown();
  process.exit(0);
});