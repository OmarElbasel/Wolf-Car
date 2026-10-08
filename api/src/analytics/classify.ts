import { createHash, createHmac } from 'node:crypto';
import type { SiteDevice, SiteSource } from '../../../shared/analytics';

/** Crawlers, link previews, monitors and scripts: never counted as visitors. */
const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp\/|telegram|monitor|uptime|pingdom|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|scrapy|phantom|puppeteer|playwright/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || userAgent.length < 20 || BOT.test(userAgent);
}

export function deviceOf(userAgent: string): SiteDevice {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

const HOSTS: [RegExp, SiteSource][] = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)snapchat\.com$/, 'snapchat'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)(twitter\.com|x\.com)$|^t\.co$/, 'x'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|yandex\.[a-z]+|baidu\.com)$/, 'search'],
];

/** Apps that open links in their own browser and send no referrer. */
const IN_APP: [RegExp, SiteSource][] = [
  [/instagram/i, 'instagram'],
  [/tiktok|musical_ly|bytedance/i, 'tiktok'],
  [/snapchat/i, 'snapchat'],
  [/fban|fbav|fb_iab/i, 'facebook'],
];

const TAGS: Record<string, SiteSource> = {
  google: 'google',
  instagram: 'instagram',
  ig: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  snapchat: 'snapchat',
  snap: 'snapchat',
  whatsapp: 'whatsapp',
  twitter: 'x',
  x: 'x',
  youtube: 'youtube',
};

/** The host of a referrer URL, or null when there is none or it is this site. */
export function referrerHost(referrer: string | undefined, ownHost: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || host === ownHost?.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

/**
 * Where a visit came from: a campaign tag on the link wins (utm_source), then
 * the referring site, then the app whose built-in browser opened the page.
 */
export function sourceOf(tag: string | undefined, host: string | null, userAgent: string): SiteSource {
  const tagged = tag ? TAGS[tag.toLowerCase()] : undefined;
  if (tagged) return tagged;
  if (host) return HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? 'other';
  if (tag) return 'other';
  return IN_APP.find(([pattern]) => pattern.test(userAgent))?.[1] ?? 'direct';
}

/**
 * Tells one day's visitors apart without a cookie and without keeping the IP
 * address: a hash of the address and browser, keyed with a value that changes
 * every day, so the same person cannot be followed from one day to the next.
 */
export function visitorHash(secret: string, day: string, ip: string, userAgent: string): string {
  const dayKey = createHmac('sha256', secret).update(`site-visitor:${day}`).digest();
  return createHash('sha256').update(dayKey).update(ip).update('\n').update(userAgent).digest('hex').slice(0, 32);
}

const LOCALE = /^\/(ar|en)(?=\/|$)/;

/** "/ar/products?x=1" → { locale: "ar", path: "/products" }. Null for anything that is not a public page. */
export function splitPath(raw: string): { locale: string; path: string } | null {
  const pathname = raw.split(/[?#]/)[0];
  const match = LOCALE.exec(pathname);
  if (!match) return null;
  const path = pathname.slice(match[0].length).replace(/\/+$/, '') || '/';
  if (/^\/(dashboard|login|showroom|slots)(\/|$)/.test(path)) return null;
  return { locale: match[1], path: path.slice(0, 200) };
}
