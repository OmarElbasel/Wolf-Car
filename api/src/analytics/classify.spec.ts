import { deviceOf, isBot, referrerHost, sourceOf, splitPath, visitorHash } from './classify';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const INSTAGRAM = `${IPHONE} Instagram 350.0.0.20.118`;

describe('visitor statistics: classifying a request', () => {
  it('drops crawlers, link previews and scripts, and keeps real browsers', () => {
    for (const ua of [
      null,
      'curl/8.7.1',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0 A',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36',
    ]) {
      expect(isBot(ua)).toBe(true);
    }
    for (const ua of [IPHONE, CHROME, ANDROID_TABLET, INSTAGRAM]) expect(isBot(ua)).toBe(false);
  });

  it('tells phones, tablets and computers apart', () => {
    expect(deviceOf(IPHONE)).toBe('mobile');
    expect(deviceOf(ANDROID_TABLET)).toBe('tablet');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('tablet');
    expect(deviceOf(CHROME)).toBe('desktop');
  });

  it('reads the referring site, ignoring the website itself and nonsense', () => {
    expect(referrerHost('https://www.google.com/search?q=wolf', 'wolfcar.qa')).toBe('google.com');
    expect(referrerHost('https://wolfcar.qa/ar/products', 'wolfcar.qa')).toBeNull();
    expect(referrerHost('https://www.wolfcar.qa/ar', 'wolfcar.qa')).toBeNull();
    expect(referrerHost('not a url', 'wolfcar.qa')).toBeNull();
    expect(referrerHost(undefined, 'wolfcar.qa')).toBeNull();
  });

  it('names the source: campaign tag first, then the referring site, then the app, else direct', () => {
    expect(sourceOf('tiktok', 'google.com', CHROME)).toBe('tiktok');
    expect(sourceOf(undefined, 'google.com.qa', CHROME)).toBe('google');
    expect(sourceOf(undefined, 'l.instagram.com', CHROME)).toBe('instagram');
    expect(sourceOf(undefined, 'm.facebook.com', CHROME)).toBe('facebook');
    expect(sourceOf(undefined, 't.co', CHROME)).toBe('x');
    expect(sourceOf(undefined, 'duckduckgo.com', CHROME)).toBe('search');
    expect(sourceOf(undefined, 'someblog.example', CHROME)).toBe('other');
    expect(sourceOf('newsletter', null, CHROME)).toBe('other');
    expect(sourceOf(undefined, null, INSTAGRAM)).toBe('instagram');
    expect(sourceOf(undefined, null, CHROME)).toBe('direct');
  });

  it('gives one visitor the same hash all day and a different one the next day', () => {
    const secret = 'a-secret-that-is-long-enough-for-the-test';
    const monday = visitorHash(secret, '2026-10-05', '37.210.1.2', IPHONE);
    expect(monday).toMatch(/^[0-9a-f]{32}$/);
    expect(visitorHash(secret, '2026-10-05', '37.210.1.2', IPHONE)).toBe(monday);
    expect(visitorHash(secret, '2026-10-06', '37.210.1.2', IPHONE)).not.toBe(monday);
    expect(visitorHash(secret, '2026-10-05', '37.210.1.3', IPHONE)).not.toBe(monday);
    expect(visitorHash(secret, '2026-10-05', '37.210.1.2', CHROME)).not.toBe(monday);
    expect(monday).not.toContain('37.210');
  });

  it('keeps public pages without their language prefix and refuses staff pages', () => {
    expect(splitPath('/ar')).toEqual({ locale: 'ar', path: '/' });
    expect(splitPath('/en/products?category=1#top')).toEqual({ locale: 'en', path: '/products' });
    expect(splitPath('/ar/packages/')).toEqual({ locale: 'ar', path: '/packages' });
    for (const path of ['/en/dashboard', '/ar/dashboard/orders', '/en/showroom', '/en/login', '/ar/slots', '/api/health', '/fr/products']) {
      expect(splitPath(path)).toBeNull();
    }
  });
});
