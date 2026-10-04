import { createTestApp, type TestApp } from './utils/app';
import { bearer, login } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

describe('PPF bookings (e2e)', () => {
  let t: TestApp;
  let world: World;
  let amani: string;
  let finance: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    world = await seedWorld(t.prisma);
    amani = (await login(t, 'reservations', PW.reservations)).token;
    finance = (await login(t, 'finance', PW.finance)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const DAY = '2031-03-10';
  const book = (body: Record<string, unknown> = {}, token = amani) =>
    t
      .http()
      .post('/api/ppf/bookings')
      .set(bearer(token))
      .send({ type: 'FULL', car: 'Land Cruiser 2024', ownerName: 'Khalid Al-Marri', receiveDate: DAY, ...body });
  const calendar = (from = DAY, to = DAY) => t.http().get('/api/ppf/calendar').query({ from, to }).set(bearer(amani));
  const dayOf = async (date = DAY) => (await calendar(date, date)).body.days[0] as { state: string; reason: string | null; fullCount: number; lightCount: number };

  it('a full PPF closes its day; one more fits as the exception, light jobs without limit', async () => {
    const first = await book({ phone: '٥٥١٢٣٤٥٦', deliveryDate: '2031-03-13', service: 'Bundle 1', note: 'Black, two keys' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      type: 'FULL',
      status: 'BOOKED',
      phone: '55123456',
      receiveDate: DAY,
      deliveryDate: '2031-03-13',
      requestedBy: null,
      createdBy: { id: world.reservationsId },
    });

    expect(await dayOf()).toMatchObject({ state: 'FULL', fullCount: 1 });
    expect((await book({ car: 'Patrol' })).status).toBe(201);
    const third = await book({ car: 'Tahoe' });
    expect(third.status).toBe(409);
    expect(third.body.code).toBe('PPF_DAY_FULL');

    expect((await book({ type: 'LIGHT', car: 'Lexus LX', service: 'Tint' })).status).toBe(201);
    expect((await book({ type: 'LIGHT', car: 'Tesla Y', service: 'Tint' })).status).toBe(201);
    expect(await dayOf()).toEqual({ date: DAY, state: 'FULL', reason: null, fullCount: 2, lightCount: 2 });
    // the delivery day is information only
    expect((await dayOf('2031-03-13')).state).toBe('OPEN');
  });

  it('cancelling frees the day and keeps the booking in the list', async () => {
    const { body: first } = await book();
    const cancelled = await t.http().post(`/api/ppf/bookings/${first.id}/cancel`).set(bearer(amani));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await dayOf()).state).toBe('OPEN');
    expect((await book({ car: 'Patrol' })).status).toBe(201);

    const cal = await calendar();
    expect(cal.body.bookings.map((b: { status: string }) => b.status).sort()).toEqual(['BOOKED', 'CANCELLED']);

    const again = await t.http().post(`/api/ppf/bookings/${first.id}/cancel`).set(bearer(amani));
    expect(again.body.code).toBe('BOOKING_CANCELLED');
    const edit = await t.http().patch(`/api/ppf/bookings/${first.id}`).set(bearer(amani)).send({ car: 'Other' });
    expect(edit.body.code).toBe('BOOKING_CANCELLED');
  });

  it('moving a full PPF onto a day with two is refused; onto a free day it works', async () => {
    await book();
    await book({ car: 'Tahoe' });
    const { body: other } = await book({ receiveDate: '2031-03-11', car: 'Patrol' });
    const clash = await t.http().patch(`/api/ppf/bookings/${other.id}`).set(bearer(amani)).send({ receiveDate: DAY });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('PPF_DAY_FULL');

    const moved = await t.http().patch(`/api/ppf/bookings/${other.id}`).set(bearer(amani)).send({ receiveDate: '2031-03-12', phone: '' });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ receiveDate: '2031-03-12', phone: null });
    expect((await dayOf('2031-03-11')).state).toBe('OPEN');
    expect((await dayOf('2031-03-12')).state).toBe('FULL');
  });

  it('turning a light job into a full PPF obeys the same rule', async () => {
    await book();
    await book({ car: 'Tahoe' });
    const { body: light } = await book({ type: 'LIGHT', car: 'Lexus LX' });
    const res = await t.http().patch(`/api/ppf/bookings/${light.id}`).set(bearer(amani)).send({ type: 'FULL' });
    expect(res.body.code).toBe('PPF_DAY_FULL');
  });

  it('a burst of full PPF bookings for one day: exactly two win', async () => {
    const burst = await Promise.all(Array.from({ length: 6 }, (_, i) => book({ car: `Car ${i}` })));
    expect(burst.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 201, 409, 409, 409, 409]);
    expect((await dayOf()).fullCount).toBe(2);
  });

  it('editing a full PPF on a day that has two is still allowed', async () => {
    await book();
    const { body: second } = await book({ car: 'Tahoe' });
    const res = await t.http().patch(`/api/ppf/bookings/${second.id}`).set(bearer(amani)).send({ note: 'bring the spare key' });
    expect(res.status).toBe(200);
  });

  it('a day closed by hand takes no bookings until it is reopened', async () => {
    const closed = await t.http().put(`/api/ppf/closed-days/${DAY}`).set(bearer(amani)).send({ reason: 'National Day' });
    expect(closed.status).toBe(200);
    expect(await dayOf()).toEqual({ date: DAY, state: 'CLOSED', reason: 'National Day', fullCount: 0, lightCount: 0 });
    for (const type of ['FULL', 'LIGHT']) expect((await book({ type })).body.code).toBe('PPF_DAY_CLOSED');

    expect((await t.http().delete(`/api/ppf/closed-days/${DAY}`).set(bearer(amani))).status).toBe(204);
    expect((await t.http().delete(`/api/ppf/closed-days/${DAY}`).set(bearer(amani))).status).toBe(404);
    expect((await book()).status).toBe(201);
  });

  it('rejects impossible days, bad ranges and unknown fields', async () => {
    const impossible = await book({ receiveDate: '2031-02-30' });
    expect(impossible.status).toBe(400);
    expect(impossible.body.code).toBe('VALIDATION_FAILED');
    expect((await book({ deliveryDate: '2031-03-09' })).body.code).toBe('DELIVERY_BEFORE_RECEIVE');
    expect((await book({ branchId: world.bo.id })).status).toBe(400);
    expect((await calendar('2031-03-01', '2031-06-01')).body.code).toBe('BAD_RANGE');
    expect((await t.http().put('/api/ppf/closed-days/2031-02-30').set(bearer(amani)).send({})).status).toBe(400);
  });

  it('view-only access can read the calendar but change nothing', async () => {
    await t.prisma.userPermissionOverride.create({ data: { userId: world.financeId, permissionKey: 'booking.ppf.read', effect: 'GRANT' } });
    expect((await t.http().get('/api/ppf/calendar').query({ from: DAY, to: DAY }).set(bearer(finance))).status).toBe(200);
    expect((await book({}, finance)).status).toBe(403);
  });

  it('writes each change to the activity log', async () => {
    const { body } = await book();
    await t.http().post(`/api/ppf/bookings/${body.id}/cancel`).set(bearer(amani));
    const log = await t.prisma.activityLog.findMany({ where: { entityType: 'PpfBooking', entityId: body.id }, orderBy: { id: 'asc' } });
    expect(log.map((l) => [l.action, l.outcome, l.actorUsername])).toEqual([
      ['ppf_booking.create', 'SUCCESS', 'reservations'],
      ['ppf_booking.cancel', 'SUCCESS', 'reservations'],
    ]);
  });

  describe('sales requests', () => {
    const pending = (over: Record<string, unknown> = {}) =>
      t.prisma.lightJobRequest.create({
        data: { date: new Date(`${DAY}T00:00:00.000Z`), salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara Al-Kuwari', phone: '55123456', note: 'Front windows tint', ...over },
      });

    it('approving adds the light job to the day and names the salesperson on it', async () => {
      await book();
      const req = await pending();
      const list = await t.http().get('/api/ppf/requests').query({ status: 'PENDING' }).set(bearer(amani));
      expect(list.body.total).toBe(1);
      expect(list.body.items[0]).toMatchObject({ id: req.id, date: DAY, note: 'Front windows tint', phone: '55123456' });

      const res = await t.http().post(`/api/ppf/requests/${req.id}/approve`).set(bearer(amani)).send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
      const cal = await calendar();
      const light = cal.body.bookings.find((b: { id: string }) => b.id === res.body.bookingId);
      expect(light).toMatchObject({ type: 'LIGHT', car: 'Lexus LX', ownerName: 'Sara Al-Kuwari', receiveDate: DAY, requestedBy: 'Yousef' });
      expect(cal.body.days[0]).toMatchObject({ state: 'FULL', lightCount: 1 });
    });

    it('approving a full PPF request books the car; a day that filled up meanwhile refuses it', async () => {
      const first = await pending({ type: 'FULL', car: 'Patrol', note: null });
      const second = await pending({ type: 'FULL', car: 'Tahoe', note: null });
      const third = await pending({ type: 'FULL', car: 'Yukon', note: null });
      const approve = (id: string) => t.http().post(`/api/ppf/requests/${id}/approve`).set(bearer(amani)).send({});

      const ok = await approve(first.id);
      expect(ok.status).toBe(200);
      expect((await calendar()).body.bookings[0]).toMatchObject({ type: 'FULL', car: 'Patrol', requestedBy: 'Yousef', note: null });
      expect((await approve(second.id)).status).toBe(200);
      expect(await dayOf()).toMatchObject({ state: 'FULL', fullCount: 2 });

      const refused = await approve(third.id);
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PPF_DAY_FULL');
      expect((await t.prisma.lightJobRequest.findUniqueOrThrow({ where: { id: third.id } })).status).toBe('PENDING');
    });

    it('two answers at once: exactly one is accepted and at most one light job exists', async () => {
      await book();
      const req = await pending();
      const [a, b] = await Promise.all([
        t.http().post(`/api/ppf/requests/${req.id}/approve`).set(bearer(amani)).send({}),
        t.http().post(`/api/ppf/requests/${req.id}/reject`).set(bearer(amani)).send({ decisionNote: 'Full' }),
      ]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 409]);
      const lights = await t.prisma.ppfBooking.count({ where: { type: 'LIGHT' } });
      expect(lights).toBe(a.status === 200 ? 1 : 0);
    });

    it('approval is rolled back when the day was closed by hand', async () => {
      await book();
      const req = await pending();
      await t.http().put(`/api/ppf/closed-days/${DAY}`).set(bearer(amani)).send({});
      const res = await t.http().post(`/api/ppf/requests/${req.id}/approve`).set(bearer(amani)).send({});
      expect(res.body.code).toBe('PPF_DAY_CLOSED');
      expect((await t.prisma.lightJobRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('PENDING');
    });
  });

  it('answers malformed input with 400, never 500', async () => {
    const { body } = await book();
    for (const patch of [{ receiveDate: null }, { type: null }, { car: null }]) {
      const res = await t.http().patch(`/api/ppf/bookings/${body.id}`).set(bearer(amani)).send(patch);
      expect([patch, res.status]).toEqual([patch, 400]);
    }
    expect((await book({ receiveDate: '0000-01-01' })).status).toBe(400);
    expect((await calendar('0000-01-01', '0000-01-02')).status).toBe(400);
    expect((await t.http().put('/api/ppf/closed-days/0000-01-01').set(bearer(amani)).send({})).status).toBe(400);
    const nul = await book({ receiveDate: '2031-03-20', car: 'Pat\u0000rol' });
    expect(nul.status).toBe(201);
    expect(nul.body.car).toBe('Patrol');
    expect((await t.http().get('/api/ppf/bookings').query({ q: 'a\u0000b' }).set(bearer(amani))).status).toBe(400);
  });

  it('the owner name is optional, and can be cleared later', async () => {
    const res = await t.http().post('/api/ppf/bookings').set(bearer(amani)).send({ type: 'FULL', car: 'Patrol', receiveDate: '2031-03-22' });
    expect(res.status).toBe(201);
    expect(res.body.ownerName).toBeNull();
    const named = await book({ receiveDate: '2031-03-23', ownerName: '' });
    expect(named.status).toBe(201);
    expect(named.body.ownerName).toBeNull();
    const { body } = await book({ receiveDate: '2031-03-24' });
    const cleared = await t.http().patch(`/api/ppf/bookings/${body.id}`).set(bearer(amani)).send({ ownerName: '' });
    expect(cleared.body.ownerName).toBeNull();
    expect((await book({ receiveDate: '2031-03-25', ownerName: 'A' })).status).toBe(400);
  });
});
