import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Browser, chromium } from 'playwright-core';
import type { Env } from '../config/env';

const MAX_CONCURRENT_PAGES = 2;
const RENDER_TIMEOUT_MS = 20_000;

/**
 * Renders trusted, server-built HTML to PDF with one shared headless Chromium
 * (Playwright). Each render gets a fresh context with JavaScript disabled and
 * the network offline; fonts and images are inlined as data: URLs.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Promise<Browser> | null = null;
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  async render(html: string): Promise<Buffer> {
    await this.acquire();
    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({ javaScriptEnabled: false, offline: true, colorScheme: 'light' });
      try {
        context.setDefaultTimeout(RENDER_TIMEOUT_MS);
        await context.route('**/*', (route) => route.abort('blockedbyclient'));
        const page = await context.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready).catch(() => undefined);
        return await page.pdf({ printBackground: true, preferCSSPageSize: true });
      } finally {
        await context.close().catch(() => undefined);
      }
    } finally {
      this.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    const browser = await this.browser?.catch(() => null);
    this.browser = null;
    await browser?.close().catch(() => undefined);
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = this.config.get('CHROME_PATH', { infer: true });
      this.browser = chromium
        .launch({
          headless: true,
          ...(executablePath ? { executablePath } : {}),
          // the container runs as a non-root user without user namespaces; the page content is
          // server-generated, JS-less and offline, which is what makes --no-sandbox acceptable here
          chromiumSandbox: false,
          args: ['--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
        })
        .then((b) => {
          b.on('disconnected', () => {
            this.logger.warn('Chromium disconnected; it will be relaunched on the next receipt');
            this.browser = null;
          });
          return b;
        })
        .catch((err: unknown) => {
          this.browser = null;
          throw err;
        });
    }
    return this.browser;
  }

  private async acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT_PAGES) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
  }

  private release(): void {
    this.active--;
    this.waiting.shift()?.();
  }
}
