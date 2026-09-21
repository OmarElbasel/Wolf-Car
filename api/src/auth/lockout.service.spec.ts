import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service';
import { LockoutService } from './lockout.service';

const config = new ConfigService({ LOGIN_MAX_ATTEMPTS: 3, LOGIN_LOCK_MINUTES: 15 });
const user = (o: Partial<{ failedLoginCount: number; lockedUntil: Date | null }> = {}) => ({
  id: 'u-1',
  failedLoginCount: 0,
  lockedUntil: null,
  showroomFailedCount: 0,
  showroomLockedUntil: null,
  ...o,
});

describe('LockoutService', () => {
  const prisma = mockDeep<PrismaService>();
  let service: LockoutService;
  beforeEach(() => {
    jest.resetAllMocks();
    service = new LockoutService(prisma, config as never);
  });

  it('reports remaining lock time', () => {
    expect(service.retryAfter(user(), 'x', 'dashboard')).toBe(0);
    expect(service.retryAfter(user({ lockedUntil: new Date(Date.now() + 60_000) }), 'x', 'dashboard')).toBeGreaterThan(55);
    expect(service.retryAfter(user({ lockedUntil: new Date(Date.now() + 60_000) }), 'x', 'showroom')).toBe(0);
  });

  it('locks an account on the Nth consecutive failure', async () => {
    prisma.user.update.mockResolvedValueOnce({ failedLoginCount: 2 } as never);
    await expect(service.registerFailure(user(), 'x', 'dashboard')).resolves.toBe(false);
    prisma.user.update.mockResolvedValueOnce({ failedLoginCount: 3 } as never);
    await expect(service.registerFailure(user(), 'x', 'dashboard')).resolves.toBe(true);
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: 'u-1' },
      data: { failedLoginCount: 0, lockedUntil: expect.any(Date) },
    });
  });

  it('counts showroom failures separately', async () => {
    prisma.user.update.mockResolvedValueOnce({ showroomFailedCount: 3 } as never);
    await expect(service.registerFailure(user(), 'x', 'showroom')).resolves.toBe(true);
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: 'u-1' },
      data: { showroomFailedCount: 0, showroomLockedUntil: expect.any(Date) },
    });
  });

  it('locks unknown usernames the same way, without touching the database', async () => {
    for (let i = 0; i < 2; i++) await expect(service.registerFailure(null, 'ghost', 'dashboard')).resolves.toBe(false);
    await expect(service.registerFailure(null, 'ghost', 'dashboard')).resolves.toBe(true);
    expect(service.retryAfter(null, 'ghost', 'dashboard')).toBeGreaterThan(0);
    expect(service.retryAfter(null, 'someone-else', 'dashboard')).toBe(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('clears counters on success only when needed', async () => {
    await service.registerSuccess(user(), 'dashboard');
    expect(prisma.user.update).not.toHaveBeenCalled();
    await service.registerSuccess(user({ failedLoginCount: 2 }), 'dashboard');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { failedLoginCount: 0, lockedUntil: null } });
  });
});
