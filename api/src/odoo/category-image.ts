import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 800;
/** the site's charcoal, so the tile sits naturally on the dark model banner */
const CHARCOAL = '#161616';
const ACCENT = '#c94a12';

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * A tab image for a category that has no car photo: the brand's logo on a
 * dark tile when one is supplied (several logos are white), else its name.
 */
export async function categoryTile({ label, logo }: { label: string; logo?: Buffer }): Promise<Buffer> {
  const size = label.length > 12 ? 96 : 132;
  const text = logo
    ? ''
    : `<rect x="540" y="486" width="120" height="10" rx="5" fill="${ACCENT}"/>
       <text x="600" y="430" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700"
         fill="#ffffff" text-anchor="middle">${escapeXml(label)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" rx="56" fill="${CHARCOAL}"/>${text}
  </svg>`;
  const tile = sharp(Buffer.from(svg));
  if (!logo) return tile.png().toBuffer();
  const fitted = await sharp(logo).resize({ width: 820, height: 480, fit: 'inside' }).png().toBuffer();
  return tile.composite([{ input: fitted, gravity: 'centre' }]).png().toBuffer();
}
