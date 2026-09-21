import { BadRequestException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { PERMISSION_KEYS } from '../../../shared/permissions';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new PermissionsService(prisma, trail);

  beforeEach(() => {
    jest.resetAllMocks();
    trail.setEntity.mockReturnValue(trail);
    trail.setChange.mockReturnValue(trail);
    prisma.$transaction.mockResolvedValue([] as never);
  });

  it('lists every permission with its group and description', () => {
    expect(service.catalog().map((p) => p.key)).toEqual(PERMISSION_KEYS);
    expect(service.catalog()[0]).toEqual(expect.objectContaining({ group: expect.any(String), description: expect.any(String) }));
  });

  it('builds the role matrix with Super Admin locked to everything', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([
      { role: 'FINANCE', permissionKey: 'product.update.price' },
      { role: 'FINANCE', permissionKey: 'product.read' },
      { role: 'CASHIER', permissionKey: 'unknown.key' },
    ] as never);
    const matrix = await service.roleMatrix();
    expect(matrix.locked).toEqual(['SUPER_ADMIN']);
    expect(matrix.roles.SUPER_ADMIN).toHaveLength(PERMISSION_KEYS.length);
    expect(matrix.roles.FINANCE).toEqual(['product.read', 'product.update.price']);
    expect(matrix.roles.CASHIER).toEqual([]);
  });

  it('refuses to edit the Super Admin role or a Super Admin user', async () => {
    await expect(service.setRolePermissions('SUPER_ADMIN', [])).rejects.toBeInstanceOf(BadRequestException);
    prisma.user.findFirst.mockResolvedValue({ id: 'a', role: 'SUPER_ADMIN', permissionOverrides: [] } as never);
    await expect(service.setUserOverrides('a', { overrides: [] }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces a role set atomically and audits before/after', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([{ role: 'CASHIER', permissionKey: 'order.confirm' }] as never);
    const after = await service.setRolePermissions('CASHIER', ['order.read.branch', 'order.confirm']);
    expect(after).toEqual(['order.confirm', 'order.read.branch']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(trail.setChange).toHaveBeenCalledWith({ permissions: ['order.confirm'] }, { permissions: after });
  });

  it('reports effective permissions for a user with overrides', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u',
      role: 'CASHIER',
      permissionOverrides: [
        { permissionKey: 'order.read.all', effect: 'GRANT' },
        { permissionKey: 'order.confirm', effect: 'REVOKE' },
      ],
    } as never);
    prisma.rolePermission.findMany.mockResolvedValue([{ permissionKey: 'order.confirm' }, { permissionKey: 'order.read.branch' }] as never);
    const view = await service.userPermissions('u');
    expect(view.effective).toEqual(['order.read.all', 'order.read.branch']);
    expect(view.overrides).toEqual([
      { permission: 'order.read.all', effect: 'GRANT' },
      { permission: 'order.confirm', effect: 'REVOKE' },
    ]);
  });
});
