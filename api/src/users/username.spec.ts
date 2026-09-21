import { mockDeep } from 'jest-mock-extended';
import { USERNAME_PATTERN } from '../../../shared/validation';
import type { PrismaService } from '../prisma/prisma.service';
import { baseUsername, generateUsername } from './username';

describe('usernames', () => {
  it('uses readable bases per role and branch', () => {
    expect(baseUsername('SUPER_ADMIN')).toBe('admin');
    expect(baseUsername('FINANCE')).toBe('finance');
    expect(baseUsername('BRANCH_MANAGER', 'GH')).toBe('gh.manager');
    expect(baseUsername('CASHIER', 'BO')).toBe('bo.cashier');
  });

  it('adds a random suffix when the base is taken, always matching the DB format', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'taken' } as never).mockResolvedValueOnce(null);
    const name = await generateUsername(prisma, 'CASHIER', 'GH');
    expect(name).toMatch(/^gh\.cashier\.[a-z2-9]{4}$/);
    expect(name).toMatch(USERNAME_PATTERN);
  });

  it('gives up after repeated collisions', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.findUnique.mockResolvedValue({ id: 'taken' } as never);
    await expect(generateUsername(prisma, 'FINANCE')).rejects.toThrow('unique username');
  });
});
