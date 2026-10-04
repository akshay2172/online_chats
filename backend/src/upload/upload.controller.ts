import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors, UseGuards, UnsupportedMediaTypeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.svg',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.php',
  '.sh',
  '.bat',
  '.cmd',
  '.exe',
]);

@Controller('api/upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + extension);
        },
      }),
      fileFilter: (req, file, cb) => {
        const extension = extname(file.originalname || '').toLowerCase();

        if (BLOCKED_EXTENSIONS.has(extension)) {
          cb(new UnsupportedMediaTypeException('File type is not allowed'), false);
          return;
        }

        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new UnsupportedMediaTypeException('Unsupported file format'), false);
          return;
        }

        cb(null, true);
      },
      limits: {
        fileSize: 30 * 1024 * 1024, // 30MB
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}