import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { ImageUploadService } from './image-upload.service';

const png = (w = 200, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#d9541a' } }).png().toBuffer();

describe('ImageUploadService', () => {
  let dir: string;
  let service: ImageUploadService;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'wolfcar-uploads-'));
    service = new ImageUploadService(new ConfigService({ UPLOAD_DIR: dir }) as never);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const code = async (p: Promise<unknown>) =>
    p.then(
      () => 'stored',
      (e: BadRequestException) => (e.getResponse() as { code: string }).code,
    );

  it('re-encodes a valid image into two WebP files named by a UUID', async () => {
    const buffer = await png(1600, 900);
    const key = await service.store({ buffer, size: buffer.length });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(readdirSync(dir).sort()).toEqual([`${key}-sm.webp`, `${key}.webp`]);
    const large = await sharp(path.join(dir, `${key}.webp`)).metadata();
    expect(large.format).toBe('webp');
    expect(large.width).toBe(1200);
    expect((await sharp(path.join(dir, `${key}-sm.webp`)).metadata()).width).toBe(480);
  });

  it('requires an image', async () => {
    expect(await code(service.store(undefined))).toBe('IMAGE_REQUIRED');
  });

  it('sniffs content instead of trusting the filename or MIME type', async () => {
    const text = Buffer.from('<?php echo "not an image"; ?>'.repeat(20));
    expect(await code(service.store({ buffer: text, size: text.length }))).toBe('UNSUPPORTED_IMAGE');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>');
    expect(await code(service.store({ buffer: svg, size: svg.length }))).toBe('UNSUPPORTED_IMAGE');
    const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;', 'binary');
    expect(await code(service.store({ buffer: gif, size: gif.length }))).toBe('UNSUPPORTED_IMAGE');
  });

  it('rejects truncated images and tiny images', async () => {
    const buffer = await png();
    const broken = buffer.subarray(0, 60);
    expect(await code(service.store({ buffer: broken, size: broken.length }))).toBe('UNREADABLE_IMAGE');
    const tiny = await png(10, 10);
    expect(await code(service.store({ buffer: tiny, size: tiny.length }))).toBe('IMAGE_TOO_SMALL');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('rejects images above 40 megapixels with a clear code', async () => {
    const huge = await png(7000, 7000);
    expect(await code(service.store({ buffer: huge, size: huge.length }))).toBe('IMAGE_TOO_LARGE');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('rejects oversize files', async () => {
    const buffer = await png();
    expect(await code(service.store({ buffer, size: 6 * 1024 * 1024 }))).toBe('FILE_TOO_LARGE');
  });

  it('removes both files of a key and ignores invalid keys', async () => {
    const buffer = await png();
    const key = await service.store({ buffer, size: buffer.length });
    await service.remove('../../etc/passwd');
    await service.remove(key);
    expect(existsSync(path.join(dir, `${key}.webp`))).toBe(false);
  });
});
