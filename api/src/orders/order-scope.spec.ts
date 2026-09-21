import { authUser } from '../../test/unit/helpers';
import { orderReadScope, orderReceiptScope, orderWriteScope } from './order-scope';

const NOTHING = { id: { in: [] } };

describe('order scopes', () => {
  it('limits branch staff to their own branch for reads and writes', () => {
    const cashier = authUser({ role: 'CASHIER', branchId: 'gh' }, ['order.read.branch']);
    expect(orderReadScope(cashier)).toEqual({ branchId: 'gh' });
    expect(orderWriteScope(cashier)).toEqual({ branchId: 'gh' });
    expect(orderReceiptScope(cashier)).toEqual({ branchId: 'gh' });
  });

  it('lets order.read.all read every branch but never write outside its own', () => {
    const finance = authUser({ role: 'FINANCE', branchId: null }, ['order.read.all']);
    expect(orderReadScope(finance)).toEqual({});
    expect(orderWriteScope(finance)).toEqual(NOTHING);
    const cashierWithAll = authUser({ role: 'CASHIER', branchId: 'gh' }, ['order.read.all']);
    expect(orderReadScope(cashierWithAll)).toEqual({});
    expect(orderWriteScope(cashierWithAll)).toEqual({ branchId: 'gh' });
  });

  it('gives the Super Admin every order', () => {
    const admin = authUser({ role: 'SUPER_ADMIN', branchId: null });
    expect(orderReadScope(admin)).toEqual({});
    expect(orderWriteScope(admin)).toEqual({});
    expect(orderReceiptScope(admin)).toEqual({});
  });

  it('matches nothing for users without a branch or read permission', () => {
    expect(orderReadScope(authUser({ role: 'CASHIER', branchId: 'gh' }, []))).toEqual(NOTHING);
    expect(orderReadScope(authUser({ role: 'FINANCE', branchId: null }, ['order.read.branch']))).toEqual(NOTHING);
  });
});
