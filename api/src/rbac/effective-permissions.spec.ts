import { PERMISSION_KEYS } from '../../../shared/permissions';
import { computeEffectivePermissions } from './effective-permissions';

describe('computeEffectivePermissions', () => {
  it('gives SUPER_ADMIN every permission regardless of overrides', () => {
    const set = computeEffectivePermissions('SUPER_ADMIN', [], [{ permissionKey: 'user.manage', effect: 'REVOKE' }]);
    expect([...set].sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it('applies user GRANT and REVOKE on top of the role', () => {
    const set = computeEffectivePermissions(
      'CASHIER',
      ['order.read.branch', 'order.confirm'],
      [
        { permissionKey: 'order.confirm', effect: 'REVOKE' },
        { permissionKey: 'order.read.all', effect: 'GRANT' },
      ],
    );
    expect([...set].sort()).toEqual(['order.read.all', 'order.read.branch']);
  });

  it('ignores unknown keys stored in the database', () => {
    const set = computeEffectivePermissions('FINANCE', ['product.read', 'legacy.key'], [
      { permissionKey: 'ghost.permission', effect: 'GRANT' },
    ]);
    expect([...set]).toEqual(['product.read']);
  });
});
