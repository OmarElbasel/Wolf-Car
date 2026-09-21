import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Public } from '../common/decorators/public.decorator';
import { ImageUploadService } from './image-upload.service';
import { UPLOAD_FILE_PATTERN } from './image-processing';

/** Serves processed product images. Filenames are server-generated UUIDs; anything else is a 404. */
@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly images: ImageUploadService) {}

  @Public()
  @Get(':file')
  serve(@Param('file') file: string, @Res() res: Response): void {
    if (!UPLOAD_FILE_PATTERN.test(file)) throw new NotFoundException();
    const root = path.resolve(this.images.uploadDir);
    const full = path.join(root, file);
    if (!full.startsWith(root + path.sep) || !existsSync(full)) throw new NotFoundException();
    res.sendFile(file, {
      root,
      dotfiles: 'deny',
      headers: {
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }
}
