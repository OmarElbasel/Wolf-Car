import sharp from 'sharp';
import { categoryTile } from './category-image';

describe('categoryTile', () => {
  it('draws a name tile when there is no logo', async () => {
    const meta = await sharp(await categoryTile({ label: 'DINZA 5' })).metadata();
    expect(meta).toMatchObject({ format: 'png', width: 1200, height: 800 });
  });

  it('places a logo on a dark tile, so a white logo stays visible on a light page', async () => {
    const logo = await sharp({ create: { width: 600, height: 280, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .png()
      .toBuffer();
    const tile = sharp(await categoryTile({ label: 'THABT', logo }));
    expect(await tile.metadata()).toMatchObject({ width: 1200, height: 800 });
    const { data, info } = await tile.raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    expect(pixel(600, 400)).toEqual([255, 255, 255]); // the logo, centred
    expect(pixel(600, 60)).toEqual([22, 22, 22]); // the tile around it
  });

  it('escapes a name that contains markup characters', async () => {
    await expect(categoryTile({ label: 'A & B <C>' })).resolves.toBeInstanceOf(Buffer);
  });
});
