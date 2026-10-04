import { createTestApp, type TestApp } from './utils/app';
import { bearer, login } from './utils/auth';
import { PW, seedWorld } from './utils/fixtures';

describe('General reservations (e2e)', () => {
  let t: TestApp;
  let amani: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await seedWorld(t.prisma);
    amani = (await login(t, 'reservations', PW.reservations)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const add = (body: Record<string, unknown>) => t.http().post('/api/reservations').set(bearer(amani)).send({ date: '2031-03-10', service: 'Ceramic coating', ...body });
  const list = (query: Record<string, string> = {}) => t.http().get('/api/reservations').query(query).set(bearer(amani));

  it('needs only a day and a service; nothing limits how many share a day', async () => {
    const bare = await add({});
    expect(bare.status).toBe(201);
    expect(bare.body).toMatchObject({ date: '2031-03-10', time: null, ownerName: null, phone: null, car: null, note: null, status: 'BOOKED' });
    expect((await add({ time: '16:30', ownerName: 'Sara', phone: '+974 5512 3456', car: 'Lexus LX', note: 'Calls back to confirm' })).status).toBe(201);
    expect((await add({ time: '09:00', service: 'Polish' })).status).toBe(201);

    const res = await list({ from: '2031-03-10', to: '2031-03-10' });
    expect(res.body.total).toBe(3);
    // no hour first, then by hour
    expect(res.body.items.map((r: { time: string | null }) => r.time)).toEqual([null, '09:00', '16:30']);
  });

  it('validates the hour, the day and the service', async () => {
    for (const body of [{ time: '25:00' }, { time: '4pm' }, { date: '2031-02-30' }, { service: '' }, { service: 'x'.repeat(201) }]) {
      expect((await add(body)).status).toBe(400);
    }
  });

  it('searches, edits and cancels', async () => {
    const { body: r } = await add({ ownerName: 'Sara Al-Kuwari', car: 'Lexus LX', time: '16:30' });
    await add({ service: 'Polish', date: '2031-03-12' });
    expect((await list({ q: 'lexus' })).body.items.map((x: { id: string }) => x.id)).toEqual([r.id]);
    expect((await list({ from: '2031-03-11' })).body.total).toBe(1);

    const edited = await t.http().patch(`/api/reservations/${r.id}`).set(bearer(amani)).send({ time: '', date: '2031-03-11' });
    expect(edited.body).toMatchObject({ time: null, date: '2031-03-11', ownerName: 'Sara Al-Kuwari' });

    const cancelled = await t.http().post(`/api/reservations/${r.id}/cancel`).set(bearer(amani));
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await list({ status: 'BOOKED' })).body.total).toBe(1);
    expect((await t.http().patch(`/api/reservations/${r.id}`).set(bearer(amani)).send({ service: 'Other' })).body.code).toBe('BOOKING_CANCELLED');
  });

  it('never reaches the sales page', async () => {
    await add({ ownerName: 'Hidden Customer', date: new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10) });
    await t.http().put('/api/ppf/sales-access/pin').set(bearer(amani)).send({ pin: '482915' });
    const unlocked = await t.http().post('/api/slots/unlock').send({ pin: '482915' });
    const cookie = (unlocked.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('wc_slt='))!.split(';')[0];
    const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
    const res = await t.http().get('/api/slots').query({ from: today, to: today }).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Hidden Customer');
  });
});
