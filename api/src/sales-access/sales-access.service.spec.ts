import type { ConfigService } from '@nestjs/config';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PasswordService } from '../auth/password.service';
import type { TokenService } from '../auth/token.service';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { SalesAccessService } from './sales-access.service';

const access = (over: Record<string, unknown> = {}) => ({
  id: 1,
  pinHash: 'hash',
  version: 3,
  failedCount: 0,
  lockedUntil: null,
  updatedById: 'u-1',
  updatedAt: new Date('2026-11-01T08:00:00.000Z'),
  ...over,
});
const code = (c: string) => ({ response: { code: c } });

describe('SalesAccessService', () => {
  const prisma = mockDeep<PrismaService>();
  const passwords = mock<PasswordService>();
  const tokens = mock<TokenService>();
  const trail = mock<AuditTrail>();
  const config = { get: (key: string) => ({ LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15 })[key] } as unknown as ConfigService<Env, true>;
  const service = new SalesAccessService(prisma, passwords, tokens, config, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null });

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.salesAccess.upsert.mockResolvedValue(access() as never);
  });

  it('reports whether a PIN exists without exposing anything else', async () => {
    expect(await service.status()).toEqual({ pinSet: true, updatedAt: new Date('2026-11-01T08:00:00.000Z') });
    prisma.salesAccess.upsert.mockResolvedValue(access({ pinHash: null }) as never);
    expect(await service.status()).toEqual({ pinSet: false, updatedAt: null });
  });

  it('setting a PIN stores only its hash, bumps the version and clears the lock', async () => {
    passwords.hash.mockResolvedValue('new-hash');
    await service.setPin(amani, '123456');
    const call = prisma.salesAccess.upsert.mock.calls[0][0];
    expect(call.update).toEqual({ pinHash: 'new-hash', version: { increment: 1 }, failedCount: 0, lockedUntil: null, updatedById: 'u-1' });
    expect(JSON.stringify([call, trail.setChange.mock.calls, trail.addMetadata.mock.calls])).not.toContain('123456');
  });

  it('the right PIN yields a token for the current version and clears the counter', async () => {
    prisma.salesAccess.updateMany.mockResolvedValue({ count: 1 });
    passwords.verify.mockResolvedValue(true);
    tokens.signSlots.mockResolvedValue({ token: 't', expiresAt: new Date() });
    await service.unlock('123456');
    expect(tokens.signSlots).toHaveBeenCalledWith(3);
    expect(prisma.salesAccess.updateMany.mock.calls.at(-1)?.[0]).toEqual({ where: { id: 1, lockedUntil: null }, data: { failedCount: 0 } });
  });

  it('every guess first claims one of the five attempts in a single conditional update', async () => {
    prisma.salesAccess.updateMany.mockResolvedValue({ count: 1 });
    passwords.verify.mockResolvedValue(false);
    await expect(service.unlock('000000')).rejects.toMatchObject(code('SALES_PIN_INVALID'));
    const [expire, claim, lock] = prisma.salesAccess.updateMany.mock.calls.map((c) => c[0]);
    expect(expire.data).toEqual({ lockedUntil: null, failedCount: 0 });
    expect(claim).toEqual({ where: { id: 1, lockedUntil: null, failedCount: { lt: 5 } }, data: { failedCount: { increment: 1 } } });
    expect(lock.where).toEqual({ id: 1, lockedUntil: null, failedCount: { gte: 5 } });
    expect((lock.data as { lockedUntil: Date }).lockedUntil.getTime() - Date.now()).toBeGreaterThan(15 * 60_000 - 1000);
  });

  it('with no attempt left, even the right PIN is refused and not checked', async () => {
    prisma.salesAccess.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
    prisma.salesAccess.findUnique.mockResolvedValue({ lockedUntil: new Date(Date.now() + 60_000) } as never);
    await expect(service.unlock('123456')).rejects.toMatchObject({ response: { code: 'SALES_PIN_LOCKED', retryAfterSeconds: 60 } });
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('without a PIN the page is closed', async () => {
    prisma.salesAccess.upsert.mockResolvedValue(access({ pinHash: null }) as never);
    await expect(service.unlock('123456')).rejects.toMatchObject(code('SALES_PIN_NOT_SET'));
  });

  it('verify accepts only a token of the current PIN version', async () => {
    prisma.salesAccess.findUnique.mockResolvedValue({ version: 3, pinHash: 'hash' } as never);
    tokens.verifySlots.mockResolvedValue(3);
    await expect(service.verify('t')).resolves.toBeUndefined();
    tokens.verifySlots.mockResolvedValue(2);
    await expect(service.verify('t')).rejects.toMatchObject(code('SALES_ACCESS_REQUIRED'));
    tokens.verifySlots.mockResolvedValue(null);
    await expect(service.verify('t')).rejects.toMatchObject(code('SALES_ACCESS_REQUIRED'));
    await expect(service.verify(undefined)).rejects.toMatchObject(code('SALES_ACCESS_REQUIRED'));
  });
});
