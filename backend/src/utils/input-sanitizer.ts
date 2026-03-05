// backend/utils/input-sanitizer.ts
import * as validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

// Create DOMPurify instance for server-side
//const window = new JSDOM('').window;
//const DOMPurify = createDOMPurify(window as unknown as Window);

export class InputSanitizer {
  // Sanitize HTML content - removes all HTML tags
  static sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // Keep text content
    });
  }

  // Sanitize message text
  static sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message format');
    }

    // Remove HTML
    let sanitized = this.sanitizeHtml(message);
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Check length
    if (sanitized.length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (sanitized.length > 5000) {
      throw new Error('Message too long (max 5000 characters)');
    }
    
    // Check for null bytes
    if (sanitized.includes('\0')) {
      throw new Error('Invalid characters in message');
    }

    // Check for control characters (except newlines and tabs)
    if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(sanitized)) {
      throw new Error('Invalid control characters in message');
    }

    return sanitized;
  }

  // Sanitize username
  static sanitizeUsername(username: string): string {
    if (!username || typeof username !== 'string') {
      throw new Error('Invalid username format');
    }

    // Remove whitespace
    username = username.trim();

    // Check length
    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be 3-20 characters');
    }

    // Allow only alphanumeric, underscore, and hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscore, and hyphen');
    }

    // Prevent reserved names
    const reserved = ['admin', 'moderator', 'system', 'bot', 'null', 'undefined'];
    if (reserved.includes(username.toLowerCase())) {
      throw new Error('This username is reserved');
    }

    return validator.escape(username);
  }

  // Sanitize email
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email format');
    }

    email = email.trim().toLowerCase();

    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Normalize email (remove dots in Gmail, etc.)
    const normalized = validator.normalizeEmail(email);
    
    return normalized || email;
  }

  // Sanitize room name
  static sanitizeRoomName(roomName: string): string {
    if (!roomName || typeof roomName !== 'string') {
      throw new Error('Invalid room name format');
    }

    roomName = roomName.trim();

    // Check length
    if (roomName.length < 3 || roomName.length > 50) {
      throw new Error('Room name must be 3-50 characters');
    }

    // Allow alphanumeric, spaces, hyphens, underscores
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(roomName)) {
      throw new Error('Room name can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    return validator.escape(roomName);
  }

  // Sanitize file names
  static sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Invalid file name');
    }

    // Remove path traversal attempts
    fileName = fileName.replace(/\.\./g, '');
    fileName = fileName.replace(/[\/\\]/g, '');
    
    // Remove special characters except dots, hyphens, underscores
    fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Limit length
    if (fileName.length > 255) {
      const parts = fileName.split('.');
      const ext = parts.pop() || '';
      const name = parts.join('.');
      fileName = name.substring(0, 251 - ext.length) + '.' + ext;
    }

    // Ensure it's not empty
    if (!fileName || fileName === '.') {
      throw new Error('Invalid file name');
    }

    return fileName;
  }

  // Detect injection attempts
  static detectInjection(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const injectionPatterns = [
      // MongoDB injection
      /(\$where|\$ne|\$gt|\$gte|\$lt|\$lte|\$or|\$and|\$in|\$nin)/i,
      
      // SQL injection
      /(union|select|insert|update|delete|drop|create|alter|exec|execute|script)/i,
      
      // XSS patterns
      /(<script|javascript:|onerror=|onload=|onclick=|onmouseover=|onfocus=|onblur=)/i,
      
      // Command injection
      /(;|\||&|`|\$\(|<\(|>\()/,
      
      // LDAP injection
      /(\*|\(|\)|&|\|)/,
    ];

    return injectionPatterns.some(pattern => pattern.test(input));
  }

  // Validate URL
  static isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
    });
  }

  // Sanitize URL
  static sanitizeUrl(url: string): string {
    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL');
    }

    // Remove potentially dangerous protocols
    if (url.match(/^(javascript|data|vbscript|file):/i)) {
      throw new Error('Dangerous URL protocol');
    }

    return url.trim();
  }

  // Validate and sanitize bio/description
  static sanitizeBio(bio: string): string {
    if (!bio || typeof bio !== 'string') {
      return '';
    }

    // Remove HTML
    let sanitized = this.sanitizeHtml(bio);
    
    // Trim
    sanitized = sanitized.trim();
    
    // Limit length
    if (sanitized.length > 500) {
      throw new Error('Bio too long (max 500 characters)');
    }

    return sanitized;
  }

  // Sanitize search query
  static sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid search query');
    }

    // Remove HTML
    let sanitized = this.sanitizeHtml(query);
    
    // Trim
    sanitized = sanitized.trim();
    
    // Limit length
    if (sanitized.length > 100) {
      throw new Error('Search query too long (max 100 characters)');
    }

    // Remove MongoDB operators
    sanitized = sanitized.replace(/\$/g, '');

    return sanitized;
  }

  // Validate country code
  static sanitizeCountry(country: string): string {
    if (!country || typeof country !== 'string') {
      return 'Unknown';
    }

    // Allow only letters and spaces
    if (!/^[a-zA-Z\s]+$/.test(country)) {
      return 'Unknown';
    }

    return validator.escape(country.trim());
  }

  // Validate gender
  static sanitizeGender(gender: string): 'male' | 'female' | 'other' {
    if (!gender || typeof gender !== 'string') {
      return 'other';
    }

    const normalized = gender.toLowerCase().trim();
    
    if (normalized === 'male' || normalized === 'female') {
      return normalized as 'male' | 'female';
    }

    return 'other';
  }

  // Sanitize generic text with length limit
  static sanitizeText(input: string, maxLength: number = 100): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove HTML tags
    let sanitized = this.sanitizeHtml(input);
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Check for null bytes
    if (sanitized.includes('\0')) {
      sanitized = sanitized.replace(/\0/g, '');
    }

    // Check for control characters (except newlines and tabs)
    if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(sanitized)) {
      sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    }

    return sanitized;
  }

  // Batch sanitization
  static sanitizeBatch(data: any, schema: any): any {
    const sanitized: any = {};

    for (const key in schema) {
      const value = data[key];
      const type = schema[key];

      try {
        switch (type) {
          case 'username':
            sanitized[key] = this.sanitizeUsername(value);
            break;
          case 'email':
            sanitized[key] = this.sanitizeEmail(value);
            break;
          case 'message':
            sanitized[key] = this.sanitizeMessage(value);
            break;
          case 'roomName':
            sanitized[key] = this.sanitizeRoomName(value);
            break;
          case 'bio':
            sanitized[key] = this.sanitizeBio(value);
            break;
          case 'url':
            sanitized[key] = this.sanitizeUrl(value);
            break;
          case 'country':
            sanitized[key] = this.sanitizeCountry(value);
            break;
          case 'gender':
            sanitized[key] = this.sanitizeGender(value);
            break;
          default:
            sanitized[key] = value;
        }
      } catch (error) {
        throw new Error(`Validation failed for ${key}: ${error.message}`);
      }
    }

    return sanitized;
  }
}

// Content Moderator
export class ContentModerator {
  // Profanity filter (add your own word list)
  private static profanityList: Set<string> = new Set([
    // Add profane words here
    'badword1', 'badword2', // placeholder
  ]);

  static containsProfanity(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const lowerText = text.toLowerCase();
    
    // Check for exact matches and word boundaries
    return Array.from(this.profanityList).some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerText);
    });
  }

  // Spam detection
  static isSpam(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    // Check for repeated characters (more than 10)
    if (/(.)\1{10,}/.test(text)) {
      return true;
    }

    // Check for excessive capitalization
    const capitals = text.match(/[A-Z]/g);
    if (capitals && capitals.length > text.length * 0.7) {
      return true;
    }

    // Check for excessive URLs
    const urlCount = (text.match(/https?:\/\//gi) || []).length;
    if (urlCount > 3) {
      return true;
    }

    // Check for credit card patterns
    if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text)) {
      return true;
    }

    // Check for phone number patterns
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = text.match(phonePattern);
    if (phoneMatches && phoneMatches.length > 2) {
      return true;
    }

    return false;
  }

  // Phishing detection
  static detectPhishing(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const phishingKeywords = [
      'verify your account',
      'click here to claim',
      'you have won',
      'urgent action required',
      'suspended account',
      'confirm your password',
      'update your payment',
      'security alert',
      'unusual activity',
      'claim your prize',
    ];

    const lowerText = text.toLowerCase();
    return phishingKeywords.some(keyword => lowerText.includes(keyword));
  }

  // Duplicate spam detection
  private static messageHistory: Map<string, Array<{ message: string; timestamp: number }>> = new Map();

  static isDuplicateSpam(userId: string, message: string, threshold: number = 3): boolean {
    const now = Date.now();
    const userHistory = this.messageHistory.get(userId) || [];

    // Remove messages older than 1 minute
    const recentMessages = userHistory.filter(msg => now - msg.timestamp < 60000);

    // Count duplicate messages
    const duplicates = recentMessages.filter(msg => msg.message === message);

    if (duplicates.length >= threshold) {
      return true;
    }

    // Add new message to history
    recentMessages.push({ message, timestamp: now });

    // Keep only last 20 messages
    if (recentMessages.length > 20) {
      recentMessages.shift();
    }

    this.messageHistory.set(userId, recentMessages);

    return false;
  }

  // Clear old history (run periodically)
  static clearOldHistory(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    this.messageHistory.forEach((history, userId) => {
      const recent = history.filter(msg => now - msg.timestamp < maxAge);
      
      if (recent.length === 0) {
        this.messageHistory.delete(userId);
      } else {
        this.messageHistory.set(userId, recent);
      }
    });
  }

  // Detect excessive mentions
  static hasExcessiveMentions(mentions: string[], threshold: number = 5): boolean {
    return mentions.length > threshold;
  }

  // Rate of messages (flood detection)
  private static messageRates: Map<string, number[]> = new Map();

  static isFlooding(userId: string, threshold: number = 5, windowMs: number = 10000): boolean {
    const now = Date.now();
    const userRates = this.messageRates.get(userId) || [];

    // Remove old timestamps
    const recent = userRates.filter(time => now - time < windowMs);

    if (recent.length >= threshold) {
      return true;
    }

    recent.push(now);
    this.messageRates.set(userId, recent);

    return false;
  }
}

// MongoDB Query Sanitizer
export class MongoSanitizer {
  static sanitizeQuery(query: any): any {
    if (typeof query !== 'object' || query === null) {
      return query;
    }

    const sanitized: any = Array.isArray(query) ? [] : {};

    for (const key in query) {
      // Block keys starting with $ (MongoDB operators)
      if (key.startsWith('$')) {
        console.warn(`⚠️ Blocked MongoDB operator in query: ${key} - input-sanitizer.ts:522`);
        continue;
      }

      let value = query[key];

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        value = this.sanitizeQuery(value);
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  static sanitizeSort(sort: any): any {
    if (typeof sort !== 'object' || sort === null) {
      return { createdAt: -1 }; // Default sort
    }

    const sanitized: any = {};

    for (const key in sort) {
      // Block $ operators
      if (key.startsWith('$')) {
        continue;
      }

      // Only allow 1 (asc) or -1 (desc)
      sanitized[key] = sort[key] === 'desc' || sort[key] === -1 ? -1 : 1;
    }

    return sanitized;
  }
}
