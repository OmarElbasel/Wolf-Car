import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '../../../shared/validation';
import type { Env } from '../config/env';
import { deleteStoredImage, processAndStoreImage } from './image-processing';

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

const reject = (code: string, message: string) =>
  new BadRequestException({ statusCode: 400, error: 'Bad Request', code, message, errors: [{ field: 'image', messages: [message] }] });

/**
 * Validates product images by their content, never by the client's filename
 * or Content-Type: magic-byte sniffing (JPEG/PNG/WebP only), a real decode,
 * size and dimension limits, then re-encoding under a random name.
 */
@Injectable()
export class ImageUploadService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get uploadDir(): string {
    return this.config.get('UPLOAD_DIR', { infer: true });
  }

  async store(file: UploadedImage | undefined): Promise<string> {
    if (!file || file.size === 0) throw reject('IMAGE_REQUIRED', 'A product image is required.');
    if (file.size > IMAGE_MAX_BYTES) throw reject('FILE_TOO_LARGE', 'The image is larger than 5 MB.');

    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !(IMAGE_MIME_TYPES as readonly string[]).includes(type.mime)) {
      throw reject('UNSUPPORTED_IMAGE', 'Only JPEG, PNG or WebP images are accepted.');
    }
    try {
      const meta = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
      if (!meta.width || !meta.height || meta.width < 64 || meta.height < 64) {
        throw reject('IMAGE_TOO_SMALL', 'The image must be at least 64 × 64 pixels.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw reject('UNREADABLE_IMAGE', 'The image file is damaged or not a real image.');
    }
    return processAndStoreImage(file.buffer, this.uploadDir);
  }

  async remove(key: string): Promise<void> {
    await deleteStoredImage(key, this.uploadDir);
  }
}
