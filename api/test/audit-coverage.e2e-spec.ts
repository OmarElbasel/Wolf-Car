import { createTestApp, type TestApp } from './utils/app';
import { appRoutes } from './utils/routes';

/**
 * "Cannot be forgotten": every route that changes state must declare how it
 * is audited. A new POST/PUT/PATCH/DELETE without @Audit or @SkipAudit fails
 * this test (and would be logged generically as http.<method> at runtime).
 */
describe('Audit coverage', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('every mutating route is audited or explicitly skipped with a reason', () => {
    const routes = appRoutes(t);
    expect(routes.length).toBeGreaterThan(40);
    const missing = routes
      .filter((r) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method))
      .filter((r) => !r.audit && !(r.skipAudit && r.skipAudit.length >= 10))
      .map((r) => `${r.method} ${r.path} (${r.controller}.${r.handler})`);
    expect(missing).toEqual([]);
  });

  it('audit actions are unique per route and follow the naming convention', () => {
    const audited = appRoutes(t).filter((r) => r.audit);
    for (const r of audited) expect(r.audit?.action).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/);
    const actions = audited.map((r) => r.audit?.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('sensitive reads are audited too (receipt downloads)', () => {
    const receipt = appRoutes(t).find((r) => r.path === '/api/orders/:id/receipt');
    expect(receipt?.audit?.action).toBe('order.receipt.download');
  });

  it('only token-rotation routes skip auditing', () => {
    expect(appRoutes(t).filter((r) => r.skipAudit).map((r) => r.path)).toEqual(['/api/auth/refresh', '/api/auth/showroom/refresh']);
  });
});
