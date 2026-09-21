import { Prisma } from '../generated/prisma/client';
import { toAuditJson } from './redact';

describe('toAuditJson', () => {
  it('redacts secret-looking keys at any depth', () => {
    expect(
      toAuditJson({ username: 'a', passwordHash: 'x', nested: { refreshToken: 'y', twoFactorSecretEnc: 'z', ok: 1 } }),
    ).toEqual({ username: 'a', passwordHash: '[redacted]', nested: { refreshToken: '[redacted]', twoFactorSecretEnc: '[redacted]', ok: 1 } });
  });

  it('serialises decimals, dates and bigints', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(toAuditJson({ price: new Prisma.Decimal('12.5'), at: d, id: BigInt(7) })).toEqual({
      price: '12.50',
      at: '2026-01-01T00:00:00.000Z',
      id: '7',
    });
  });

  it('returns null for missing values', () => {
    expect(toAuditJson(undefined)).toBeNull();
  });
});
