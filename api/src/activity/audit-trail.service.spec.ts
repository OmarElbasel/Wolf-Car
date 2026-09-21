import { ClsService, ClsServiceManager } from 'nestjs-cls';
import { AuditTrail } from './audit-trail.service';

describe('AuditTrail', () => {
  const cls: ClsService = ClsServiceManager.getClsService();
  const trail = new AuditTrail(cls);

  it('accumulates request-scoped audit details', async () => {
    await cls.run(async () => {
      trail
        .setActor({ id: 'u', username: 'x', role: 'CASHIER', branchId: 'b' })
        .setEntity('Order', 'o-1')
        .setChange({ status: 'PENDING' }, { status: 'CONFIRMED' })
        .addMetadata({ a: 1 })
        .addMetadata({ b: 2 });
      expect(trail.snapshot()).toMatchObject({
        actor: { username: 'x' },
        entityType: 'Order',
        entityId: 'o-1',
        before: { status: 'PENDING' },
        after: { status: 'CONFIRMED' },
        metadata: { a: 1, b: 2 },
      });
    });
  });

  it('keeps requests isolated and is a no-op outside a request', async () => {
    await Promise.all([
      cls.run(async () => {
        trail.setEntity('Order', 'first');
        await new Promise((r) => setTimeout(r, 5));
        expect(trail.snapshot().entityId).toBe('first');
      }),
      cls.run(async () => {
        trail.setEntity('Order', 'second');
        expect(trail.snapshot().entityId).toBe('second');
      }),
    ]);
    expect(() => trail.setEntity('X', 'y')).not.toThrow();
    expect(trail.snapshot()).toEqual({});
  });
});
