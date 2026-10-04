import { createTestApp, type TestApp } from './utils/app';
import { seedWorld, type World } from './utils/fixtures';

/** Rules the database enforces on its own, whatever the application does. */
describe('Booking tables: database constraints (e2e)', () => {
  let t: TestApp;
  let world: World;
  const day = new Date('2026-11-02T00:00:00.000Z');

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    world = await seedWorld(t.prisma);
  });
  afterAll(async () => {
    await t.close();
  });

  const booking = (over: Record<string, unknown> = {}) =>
    t.prisma.ppfBooking.create({
      data: { type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid', receiveDate: day, createdById: world.reservationsId, ...over },
    });

  it('leaves the number of full PPF cars per day to the API; requests are light jobs unless they say otherwise', async () => {
    await booking();
    await expect(booking()).resolves.toMatchObject({ type: 'FULL' });
    const request = await t.prisma.lightJobRequest.create({ data: { date: day, salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara' } });
    expect(request).toMatchObject({ type: 'LIGHT', note: null, status: 'PENDING' });
  });

  it('allows light jobs, and a new full PPF once the first is cancelled', async () => {
    const first = await booking();
    await booking({ type: 'LIGHT' });
    await booking({ type: 'LIGHT' });
    await t.prisma.ppfBooking.update({ where: { id: first.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await expect(booking()).resolves.toMatchObject({ type: 'FULL', status: 'BOOKED' });
  });

  it('refuses a delivery day before the receive day', async () => {
    await expect(booking({ deliveryDate: new Date('2026-11-01T00:00:00.000Z') })).rejects.toThrow();
  });

  it('keeps status and cancelled_at in step', async () => {
    await expect(booking({ status: 'CANCELLED' })).rejects.toThrow();
    await expect(booking({ cancelledAt: new Date() })).rejects.toThrow();
  });

  it('stores a day without shifting it (session time zone is Asia/Qatar)', async () => {
    const row = await booking();
    const [raw] = await t.prisma.$queryRaw<{ d: string }[]>`SELECT receive_date::text AS d FROM ppf_bookings WHERE id = ${row.id}::uuid`;
    expect(raw.d).toBe('2026-11-02');
    expect(row.receiveDate.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('holds a single sales-access row', async () => {
    await t.prisma.salesAccess.create({ data: {} });
    await expect(t.prisma.salesAccess.create({ data: { id: 2 } })).rejects.toThrow();
  });
});
