import sharp from 'sharp';

/** A neutral card for products Odoo has no photo of. */
export async function placeholderImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
    <rect width="1200" height="1200" fill="#f5f4f1"/>
    <rect x="390" y="430" width="420" height="300" rx="28" fill="none" stroke="#c9c4ba" stroke-width="22"/>
    <circle cx="505" cy="535" r="38" fill="#c9c4ba"/>
    <path d="M410 700 L560 580 L650 650 L720 600 L790 700 Z" fill="#c9c4ba"/>
    <text x="600" y="1110" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700"
      letter-spacing="10" fill="#9c968c" text-anchor="middle">WOLF CAR</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
