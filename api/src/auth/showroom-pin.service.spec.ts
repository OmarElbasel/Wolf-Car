import type { ConfigService } from '@nestjs/config';
import { mock, mockDeep } from 'jest-mock-extended';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import type { PasswordService } from './password.service';
import { ShowroomPinService } from './showroom-pin.service';
import type { TokenService } from './token.service';

const code = (c: string) => ({ response: { code: c } });

describe('ShowroomPinService', () => {
  const prisma = mockDeep<PrismaService>();
  const passwords = mock<PasswordService>();
  const tokens = mock<TokenService>();
  const config = { get: (key: string) => ({ LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15 })[key] } as unknown as ConfigService<Env, true>;
  const service = new ShowroomPinService(prisma, passwords, tokens, config);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.branch.findUnique.mockResolvedValue({ isActive: true, showroomPinHash: 'hash' } as never);
    prisma.branch.updateMany.mockResolvedValue({ count: 1 });
  });

  it('accepts the right PIN and clears the wrong-PIN count', async () => {
    passwords.verify.mockResolvedValue(true);
    await expect(service.check('bo', '482913')).resolves.toBeUndefined();
    expect(passwords.verify).toHaveBeenCalledWith('hash', '482913');
    expect(prisma.branch.updateMany).toHaveBeenLastCalledWith({ where: { id: 'bo', showroomPinLockedUntil: null }, data: { showroomPinFailedCount: 0 } });
  });

  it('refuses a wrong PIN and starts the lock once the attempts are used up', async () => {
    passwords.verify.mockResolvedValue(false);
    await expect(service.check('bo', '000000')).rejects.toMatchObject(code('SHOWROOM_PIN_INVALID'));
    expect(prisma.branch.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'bo', showroomPinLockedUntil: null, showroomPinFailedCount: { gte: 5 } },
      data: { showroomPinLockedUntil: expect.any(Date) },
    });
  });

  it('does not even look at the PIN while the branch is locked', async () => {
    const until = new Date(Date.now() + 10 * 60_000);
    // 1st call frees an expired lock, 2nd claims an attempt: none left
    prisma.branch.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
    prisma.branch.findUnique.mockResolvedValueOnce({ isActive: true, showroomPinHash: 'hash' } as never).mockResolvedValueOnce({ showroomPinLockedUntil: until } as never);

    await expect(service.check('bo', '482913')).rejects.toMatchObject({ response: { code: 'SHOWROOM_PIN_LOCKED', retryAfterSeconds: expect.any(Number) } });
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('answers an unknown, closed or PIN-less branch exactly like a wrong PIN', async () => {
    for (const branch of [null, { isActive: false, showroomPinHash: 'hash' }, { isActive: true, showroomPinHash: null }]) {
      prisma.branch.findUnique.mockResolvedValue(branch as never);
      await expect(service.check('x', '482913')).rejects.toMatchObject(code('SHOWROOM_PIN_INVALID'));
    }
    expect(passwords.verifyDummy).toHaveBeenCalledTimes(3);
    expect(prisma.branch.updateMany).not.toHaveBeenCalled();
  });

  it('signs the branch\'s screens out when the PIN changes', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 'bo' } as never);
    passwords.hash.mockResolvedValue('new-hash');
    prisma.user.findMany.mockResolvedValue([{ id: 'u-cashier' }, { id: 'u-manager' }] as never);

    await service.setPin('bo', '482913');
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: 'bo' },
      data: { showroomPinHash: 'new-hash', showroomPinFailedCount: 0, showroomPinLockedUntil: null },
    });
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-cashier', 'showroom_pin_changed', { audience: 'SHOWROOM' });
    expect(tokens.revokeUserSessions).toHaveBeenCalledWith('u-manager', 'showroom_pin_changed', { audience: 'SHOWROOM' });
  });

  it('lists only open branches that have a PIN, and never the PIN', async () => {
    prisma.branch.findMany.mockResolvedValue([] as never);
    await service.branches();
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      where: { isActive: true, showroomPinHash: { not: null } },
      select: { id: true, code: true, name: true, nameAr: true },
      orderBy: { code: 'asc' },
    });
  });
});
