import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const IMAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const UPLOAD_FILE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(-sm)?\.webp$/;

const LARGE = 1200;
const SMALL = 480;

/** Public URL of a stored product image (served by UploadsController). */
export function imageUrl(key: string, size: 'lg' | 'sm' = 'lg'): string {
  return `/api/uploads/${key}${size === 'sm' ? '-sm' : ''}.webp`;
}

/**
 * Re-encodes an (already type-checked) image into two WebP files named by a
 * fresh UUID. Re-encoding strips EXIF/GPS metadata and anything appended to
 * the file (polyglots); the original bytes are never written to disk.
 */
export async function processAndStoreImage(input: Buffer, uploadDir: string): Promise<string> {
  const key = randomUUID();
  await mkdir(uploadDir, { recursive: true });
  const base = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate();
  const [large, small] = await Promise.all([
    base.clone().resize({ width: LARGE, height: LARGE, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    base.clone().resize({ width: SMALL, height: SMALL, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
  ]);
  // write to temp names first so a crash never leaves a half-written file under the final name
  const files: [string, Buffer][] = [
    [`${key}.webp`, large],
    [`${key}-sm.webp`, small],
  ];
  for (const [name, data] of files) {
    const tmp = path.join(uploadDir, `.${name}.tmp`);
    await writeFile(tmp, data, { mode: 0o644 });
    await rename(tmp, path.join(uploadDir, name));
  }
  return key;
}

export async function deleteStoredImage(key: string, uploadDir: string): Promise<void> {
  if (!IMAGE_KEY_PATTERN.test(key)) return;
  await Promise.all([
    rm(path.join(uploadDir, `${key}.webp`), { force: true }),
    rm(path.join(uploadDir, `${key}-sm.webp`), { force: true }),
  ]);
}
