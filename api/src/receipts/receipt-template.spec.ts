import { escapeHtml, formatDate, formatMoney, renderReceiptHtml, type ReceiptData } from './receipt-template';

const assets = {
  fonts: { arabic400: 'data:a', arabic700: 'data:b', latin400: 'data:c', latin700: 'data:d' },
  logo: 'data:image/png;base64,AAAA',
};

const data: ReceiptData = {
  code: 'GH-000042',
  createdAt: new Date('2026-09-21T09:00:00Z'),
  confirmedAt: new Date('2026-09-21T10:30:00Z'),
  customerName: 'Sara <b>Al</b>-Mansouri',
  currency: 'QAR',
  total: '1118.50',
  branch: { name: 'Al Gharrafa Branch', nameAr: 'فرع الغرافة' },
  cashier: 'GH Cashier',
  items: [
    { productName: 'Dash Cam <script>alert(1)</script>', quantity: 2, unitPrice: '499.00', lineTotal: '998.00' },
    { productName: 'عطر سيارة فاخر', quantity: 1, unitPrice: '120.50', lineTotal: '120.50' },
  ],
};

describe('receipt template', () => {
  it('escapes every dynamic value', () => {
    const html = renderReceiptHtml(data, 'en', assets);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('Dash Cam &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Sara &lt;b&gt;Al&lt;/b&gt;-Mansouri');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('contains everything a receipt needs', () => {
    // Intl separates currency and amount with a no-break space
    const html = renderReceiptHtml(data, 'en', assets).replace(/\u00a0/g, ' ');
    for (const part of ['GH-000042', 'Al Gharrafa Branch', 'Grand total', 'QAR 998.00', 'QAR 1,118.50', 'GH Cashier', 'عطر سيارة فاخر']) {
      expect(html).toContain(part);
    }
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("default-src 'none'");
  });

  it('renders Arabic right-to-left with the Arabic branch name and Latin digits', () => {
    const html = renderReceiptHtml(data, 'ar', assets);
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('فرع الغرافة');
    expect(html).toContain('الإجمالي الكلي');
    expect(formatMoney('1118.5', 'QAR', 'ar')).toMatch(/1,118\.50/);
  });

  it('formats dates in Qatar time', () => {
    expect(formatDate(new Date('2026-09-21T22:30:00Z'), 'en')).toContain('Sep 22, 2026');
  });
});
