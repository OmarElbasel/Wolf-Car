import { baseBarcodes, branchBarcode } from './branch-barcodes';

const v = (odooTemplateId: number, barcode: string | null, variantLabel: string | null = 'أسود') => ({ odooTemplateId, barcode, variantLabel });

describe('baseBarcodes', () => {
  it('drops the last digit that tells the colours of one product apart', () => {
    const bases = baseBarcodes([v(1, '10011100161'), v(1, '10011100162'), v(1, '10011100163')]);
    expect(bases.get(1)).toBe('1001110016');
  });

  it('keeps the code whole when one colour already carries the plain code', () => {
    // Odoo has "1001030107" for one colour and "10010301071" for the other
    expect(baseBarcodes([v(2, '1001030107'), v(2, '10010301071')]).get(2)).toBe('1001030107');
  });

  it('has no shared code for a product in one colour, without barcodes, or whose codes are unrelated', () => {
    const bases = baseBarcodes([v(3, '10011100161'), v(4, null), v(4, null), v(5, '1001110016'), v(5, '2009990012')]);
    expect(bases.size).toBe(0);
  });

  it('ignores products that are not colours of anything', () => {
    expect(baseBarcodes([v(6, '1001110016', null), v(6, '1001110017', null)]).size).toBe(0);
  });
});

describe('branchBarcode', () => {
  const bases = new Map([[1, '1001110016']]);

  it('gives a colour the shared code at a branch that scans without the colour digit', () => {
    expect(branchBarcode(v(1, '10011100162'), bases)).toBe('1001110016');
  });

  it("leaves every other product's barcode alone", () => {
    expect(branchBarcode(v(9, '1001050026', null), bases)).toBe('1001050026');
    expect(branchBarcode(v(9, null, null), bases)).toBeNull();
  });

  it("is Odoo's own barcode at a branch that uses Odoo", () => {
    expect(branchBarcode(v(1, '10011100162'), null)).toBe('10011100162');
  });
});
