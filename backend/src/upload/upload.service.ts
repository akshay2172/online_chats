// backend/upload/upload.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { fileTypeFromBuffer } from 'file-type';

import * as sharp from 'sharp'; // For image validation

@Injectable()
export class UploadService {
    private readonly UPLOAD_DIR = './uploads';
    private readonly AVATAR_DIR = './uploads/avatars';
    private readonly MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
    private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private readonly ALLOWED_FILE_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
    ];

    private readonly ALLOWED_AUDIO_TYPES = [
        'audio/mpeg',      // mp3
        'audio/wav',
        'audio/ogg',
        'audio/webm',
    ];

    private readonly ALLOWED_VIDEO_TYPES = [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime', // .mov
    ];

    async validateAndUploadFile(file: Express.Multer.File): Promise<string> {
        // 1. Check file size
        if (file.size > this.MAX_FILE_SIZE) {
            throw new Error('File size exceeds limit (30MB)');
        }

        // 2. Validate MIME type using file-type (checks actual file content, not just extension)
        const fileTypeResult = await fileTypeFromBuffer(file.buffer);


        if (!fileTypeResult) {
            throw new Error('Unable to determine file type');
        }

        const isAllowedImage = this.ALLOWED_IMAGE_TYPES.includes(fileTypeResult.mime);
        const isAllowedFile = this.ALLOWED_FILE_TYPES.includes(fileTypeResult.mime);
        const isAllowedAudio = this.ALLOWED_AUDIO_TYPES.includes(fileTypeResult.mime);
        const isAllowedVideo = this.ALLOWED_VIDEO_TYPES.includes(fileTypeResult.mime);

        if (!isAllowedImage && !isAllowedFile && !isAllowedAudio && !isAllowedVideo) {
            throw new Error('File type not allowed');
        }

        // 3. Additional validation for images
        if (isAllowedImage) {
            await this.validateImage(file.buffer);
        }

        // 4. Generate secure filename
        const secureFilename = this.generateSecureFilename(file.originalname, fileTypeResult.ext);

        // 5. Scan for malware (if you have ClamAV installed)
        // await this.scanForMalware(file.buffer);

        // 6. Save file
        const filePath = path.join(this.UPLOAD_DIR, secureFilename);
        await fs.promises.writeFile(filePath, file.buffer);

        return `/uploads/${secureFilename}`;
    }

    async validateAndUploadAvatar(file: Express.Multer.File): Promise<string> {
        // 1. Check file size (5MB max for avatars)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Avatar size exceeds limit (5MB)');
        }

        // 2. Validate MIME type
        const fileTypeResult = await fileTypeFromBuffer(file.buffer);
        if (!fileTypeResult || !this.ALLOWED_IMAGE_TYPES.includes(fileTypeResult.mime)) {
            throw new Error('Avatar must be an image (JPEG, PNG, GIF, or WebP)');
        }

        // 3. Validate image dimensions
        await this.validateImage(file.buffer);

        // 4. Ensure avatars directory exists
        await fs.promises.mkdir(this.AVATAR_DIR, { recursive: true });

        // 5. Generate secure filename
        const secureFilename = this.generateSecureFilename(file.originalname, fileTypeResult.ext);

        // 6. Save to avatars directory
        const filePath = path.join(this.AVATAR_DIR, secureFilename);
        await fs.promises.writeFile(filePath, file.buffer);

        return `/uploads/avatars/${secureFilename}`;
    }

    private async validateImage(buffer: Buffer): Promise<void> {
        try {
            // Use sharp to validate and get image metadata
            const metadata = await sharp(buffer).metadata();

            // Check dimensions
            if (metadata.width && metadata.width > 5000) {
                throw new Error('Image width exceeds limit');
            }
            if (metadata.height && metadata.height > 5000) {
                throw new Error('Image height exceeds limit');
            }

            // Strip metadata (EXIF data can contain malicious code)
            await sharp(buffer).rotate().toBuffer();
        } catch (error) {
            throw new Error('Invalid or corrupted image file');
        }
    }

    private generateSecureFilename(originalName: string, extension: string): string {
        // Generate random hash
        const hash = crypto.randomBytes(16).toString('hex');

        // Get timestamp
        const timestamp = Date.now();

        // Create secure filename
        return `${timestamp}-${hash}.${extension}`;
    }

    // Optional: ClamAV malware scanning
    private async scanForMalware(buffer: Buffer): Promise<void> {
        // If you have ClamAV installed:
        // const NodeClam = require('clamscan');
        // const clamscan = await new NodeClam().init();
        // const { isInfected } = await clamscan.scanBuffer(buffer);
        // if (isInfected) {
        //   throw new Error('File contains malware');
        // }
    }

    // Delete old files (cleanup job)
    async cleanupOldFiles(daysOld: number = 30): Promise<void> {
        const files = await fs.promises.readdir(this.UPLOAD_DIR);
        const now = Date.now();
        const maxAge = daysOld * 24 * 60 * 60 * 1000;

        for (const file of files) {
            // Skip the avatars directory — profile pictures should persist permanently
            if (file === 'avatars') continue;

            const filePath = path.join(this.UPLOAD_DIR, file);
            const stats = await fs.promises.stat(filePath);

            // Skip directories
            if (stats.isDirectory()) continue;

            if (now - stats.mtime.getTime() > maxAge) {
                await fs.promises.unlink(filePath);
                console.log(`Deleted old file: ${file} - upload.service.ts:131`);
            }
        }
    }
}