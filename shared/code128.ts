/**
 * CODE128 barcode rendering, shared by the web cashier view and the PDF
 * receipt. Pure and dependency-free on purpose: the receipt is printed by
 * headless Chromium with JavaScript disabled, so the bars have to arrive as
 * ready-made SVG markup rather than being drawn in the page.
 *
 * Only Code B and Code C are implemented — between them they cover every
 * barcode the catalogue holds (printable ASCII, mostly 10 digits). Code A's
 * control characters have no use here.
 */

/**
 * Bar/space run lengths for symbol values 0..106, as six digits per entry
 * (bar, space, bar, space, bar, space). Index 103-105 are the start codes,
 * 106 is the stop code — the only seven-run, 13-module entry.
 */
export const CODE128_PATTERN = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
] as const;

const START_B = 104;
const START_C = 105;
const STOP = 106;

/** Code B covers printable ASCII: value = codePoint - 32. */
const isPrintableAscii = (s: string) => /^[\x20-\x7e]+$/.test(s);
const isEvenDigits = (s: string) => s.length % 2 === 0 && /^\d+$/.test(s);

/** Whether {@link code128Svg} can draw this value at all. */
export function isCode128Encodable(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && isPrintableAscii(value);
}

/**
 * Symbol values for `value`, including the start code, the modulo-103 check
 * symbol and the stop code. All-digit even-length strings go out in Code C
 * (two digits per symbol, half the width); everything else uses Code B.
 */
export function code128Values(value: string): number[] {
  if (!value) throw new Error("CODE128: cannot encode an empty value");
  if (!isPrintableAscii(value)) {
    throw new Error(`CODE128: ${JSON.stringify(value)} is not encodable (printable ASCII only)`);
  }

  const useC = isEvenDigits(value);
  const start = useC ? START_C : START_B;
  const data: number[] = [];
  if (useC) {
    for (let i = 0; i < value.length; i += 2) data.push(Number(value.slice(i, i + 2)));
  } else {
    for (const ch of value) data.push(ch.charCodeAt(0) - 32);
  }

  // weighted modulo-103 checksum; the start code carries weight 1
  let sum = start;
  data.forEach((v, i) => {
    sum += v * (i + 1);
  });
  return [start, ...data, sum % 103, STOP];
}

/** The barcode as a string of "1" (bar) and "0" (space) modules. */
export function code128Modules(value: string): string {
  let out = "";
  for (const symbol of code128Values(value)) {
    const widths = CODE128_PATTERN[symbol];
    for (let i = 0; i < widths.length; i++) {
      // runs alternate bar, space, bar, ... starting on a bar
      out += (i % 2 === 0 ? "1" : "0").repeat(Number(widths[i]));
    }
  }
  return out;
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string);

export interface Code128SvgOptions {
  /** Width of one module in px (bar width). */
  moduleWidth?: number;
  /** Height of the bars in px, excluding the caption. */
  height?: number;
  /** Caption under the bars; defaults to the encoded value. */
  label?: string;
  /** Set false to draw bars only. */
  showLabel?: boolean;
  /** Quiet zone in modules on each side — 10 is the ISO minimum. */
  quietZone?: number;
}

/**
 * Self-contained SVG for `value`, or "" when it cannot be encoded (so callers
 * can fall back to plain text). `currentColor` keeps the bars readable in both
 * the light and dark dashboard themes.
 */
export function code128Svg(value: string | null | undefined, options: Code128SvgOptions = {}): string {
  if (!isCode128Encodable(value)) return "";
  const { moduleWidth = 2, height = 56, showLabel = true, quietZone = 10 } = options;
  const label = options.label ?? value;

  const modules = code128Modules(value);
  const fontSize = Math.max(9, Math.round(height * 0.22));
  const labelGap = showLabel ? fontSize + 5 : 0;
  const width = (modules.length + quietZone * 2) * moduleWidth;
  const totalHeight = height + labelGap;

  // one <rect> per run of bars rather than per module, so the markup stays small
  const rects: string[] = [];
  let run = 0;
  for (let i = 0; i <= modules.length; i++) {
    if (modules[i] === "1") {
      run++;
      continue;
    }
    if (run > 0) {
      const x = (quietZone + i - run) * moduleWidth;
      rects.push(`<rect x="${x}" y="0" width="${run * moduleWidth}" height="${height}"/>`);
      run = 0;
    }
  }

  const caption = showLabel
    ? `<text x="${width / 2}" y="${totalHeight - 1}" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace"` +
      ` font-size="${fontSize}" letter-spacing="1" fill="currentColor">${escapeXml(label)}</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}"` +
    ` viewBox="0 0 ${width} ${totalHeight}" role="img" aria-label="${escapeXml(label)}">` +
    `<g fill="currentColor">${rects.join("")}</g>${caption}</svg>`
  );
}
