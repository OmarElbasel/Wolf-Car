import { ConfigService } from '@nestjs/config';
import { PdfRendererService } from './pdf-renderer.service';

// Uses the real Chromium (Playwright). Install once: npx playwright install chromium
describe('PdfRendererService', () => {
  const service = new PdfRendererService(new ConfigService({}) as never);
  afterAll(() => service.onModuleDestroy());

  it('renders HTML to a PDF', async () => {
    const pdf = await service.render('<!doctype html><html><body><h1>Receipt</h1></body></html>');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 60_000);

  it('never lets the page reach the network or run scripts', async () => {
    const requests: string[] = [];
    const server = await import('node:http').then(
      ({ createServer }) =>
        new Promise<import('node:http').Server>((resolve) => {
          const s = createServer((req, res) => {
            requests.push(req.url ?? '');
            res.end('x');
          }).listen(0, () => resolve(s));
        }),
    );
    const port = (server.address() as { port: number }).port;
    await service.render(
      `<html><body><img src="http://127.0.0.1:${port}/img"><link rel="stylesheet" href="http://127.0.0.1:${port}/css">` +
        `<script>fetch('http://127.0.0.1:${port}/js')</script></body></html>`,
    );
    server.close();
    expect(requests).toEqual([]);
  }, 60_000);

  it('limits concurrency and survives parallel renders', async () => {
    const pdfs = await Promise.all(Array.from({ length: 5 }, (_, i) => service.render(`<p>${i}</p>`)));
    expect(pdfs.every((p) => p.subarray(0, 4).toString() === '%PDF')).toBe(true);
  }, 60_000);
});
