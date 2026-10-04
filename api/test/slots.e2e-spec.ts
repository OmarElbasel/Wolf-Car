import { createTestApp, type TestApp } from './utils/app';
import { bearer, csrf, login } from './utils/auth';
import { PW, seedWorld } from './utils/fixtures';

const DAY_MS = 86_400_000;
const qatarDay = (offsetDays = 0) => new Date(Date.now() + 3 * 3_600_000 + offsetDays * DAY_MS).toISOString().slice(0, 10);

describe('Sales slots page (e2e)', () => {
  let t: TestApp;
  let amani: string;
  const PIN = '482915';
  const today = qatarDay();
  const tomorrow = qatarDay(1);
  const range = { from: `${today.slice(0, 7)}-01`, to: qatarDay(40) };

  beforeAll(async () => {
    // this file unlocks many times from one IP; the strict limit has its own spec
    t = await createTestApp({ AUTH_THROTTLE_LIMIT: '1000' });
  });
  beforeEach(async () => {
    await seedWorld(t.prisma);
    amani = (await login(t, 'reservations', PW.reservations)).token;
  });
  afterAll(async () => {
    await t.close();
  });

  const setPin = (pin = PIN) => t.http().put('/api/ppf/sales-access/pin').set(bearer(amani)).send({ pin });
  const unlock = (pin = PIN) => t.http().post('/api/slots/unlock').send({ pin });
  const cookieOf = (res: { headers: Record<string, unknown> }) =>
    ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith('wc_slt='))?.split(';')[0] ?? '';
  const view = (cookie: string, q = range) => t.http().get('/api/slots').query(q).set('Cookie', cookie);
  const book = (body: Record<string, unknown>) =>
    t.http().post('/api/ppf/bookings').set(bearer(amani)).send({ type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid Al-Marri', receiveDate: tomorrow, ...body });
  const ask = (cookie: string, body: Record<string, unknown> = {}) =>
    t
      .http()
      .post('/api/slots/requests')
      .set('Cookie', cookie)
      .set(csrf)
      .send({ date: tomorrow, salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara Al-Kuwari', note: 'Front windows tint', ...body });

  it('is closed until a PIN is set', async () => {
    expect((await t.http().get('/api/ppf/sales-access').set(bearer(amani))).body).toEqual({ pinSet: false, updatedAt: null });
    expect((await unlock()).body.code).toBe('SALES_PIN_NOT_SET');
    expect((await view('')).status).toBe(401);
  });

  it('the PIN opens the page with a strict, httpOnly cookie scoped to /api/slots', async () => {
    expect((await setPin()).body.pinSet).toBe(true);
    expect((await setPin('12345')).status).toBe(400);
    expect((await unlock('000000')).body.code).toBe('SALES_PIN_INVALID');

    const res = await unlock('٤٨٢٩١٥'); // typed on an Arabic keyboard
    expect(res.status).toBe(200);
    const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('wc_slt='))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Strict/i);
    expect(raw).toMatch(/Path=\/api\/slots/);
    expect((res.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('wc_slots=1'))).toBe(true);
    expect((await view(cookieOf(res))).status).toBe(200);
  });

  it('shows days, booked cars and requests — and nothing internal', async () => {
    await setPin();
    await book({ phone: '55123456', deliveryDate: qatarDay(4), note: 'internal note', service: 'Bundle 1' });
    await book({ type: 'LIGHT', car: 'Tesla Y', ownerName: 'Noor' });
    const cookie = cookieOf(await unlock());

    const res = await view(cookie);
    expect(res.body.today).toBe(today);
    expect(res.body.days.find((d: { date: string }) => d.date === tomorrow)).toEqual({ date: tomorrow, state: 'FULL', reason: null, lightCount: 1 });
    expect(res.body.bookings).toHaveLength(2);
    expect(Object.keys(res.body.bookings[0]).sort()).toEqual(['car', 'deliveryDate', 'id', 'ownerName', 'phone', 'receiveDate', 'type']);
    expect(res.body.bookings[0]).toMatchObject({ type: 'FULL', car: 'Land Cruiser', phone: '55123456', deliveryDate: qatarDay(4) });
    const text = JSON.stringify(res.body);
    for (const leak of ['internal note', 'Bundle 1', 'createdBy', 'reservations']) expect(text).not.toContain(leak);
  });

  it('a slots cookie opens no dashboard route, and a dashboard token opens no slots route', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());
    const token = cookie.replace('wc_slt=', '');
    expect((await t.http().get('/api/ppf/calendar').query(range).set(bearer(token))).status).toBe(401);
    expect((await t.http().get('/api/slots').query(range).set(bearer(amani))).status).toBe(401);
    expect((await t.http().get('/api/slots').query(range).set('Cookie', `wc_slt=${amani}`)).status).toBe(401);
  });

  it('sales can ask for a light job only on a day closed by a full PPF', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());

    expect((await ask(cookie)).body.code).toBe('PPF_DAY_NOT_FULL'); // open day
    await book({});
    expect((await ask(cookie, { date: qatarDay(-1) })).body.code).toBe('REQUEST_DAY_PAST');
    expect((await t.http().post('/api/slots/requests').set('Cookie', cookie).send({})).body.code).toBe('CSRF');
    expect((await ask(cookie, { note: '' })).status).toBe(400);

    const ok = await ask(cookie, { phone: '٥٥١٢٣٤٥٦' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ date: tomorrow, salesName: 'Yousef', car: 'Lexus LX', status: 'PENDING' });
    expect((await t.prisma.lightJobRequest.findUniqueOrThrow({ where: { id: ok.body.id } })).phone).toBe('55123456');

    await t.http().put(`/api/ppf/closed-days/${tomorrow}`).set(bearer(amani)).send({});
    expect((await ask(cookie)).body.code).toBe('PPF_DAY_NOT_FULL'); // closed by hand

    const listed = await view(cookie);
    expect(listed.body.requests).toHaveLength(1);
    expect(Object.keys(listed.body.requests[0]).sort()).toEqual(['car', 'createdAt', 'date', 'decisionNote', 'id', 'salesName', 'status']);
  });

  it('the answer reaches the sales page', async () => {
    await setPin();
    await book({});
    const cookie = cookieOf(await unlock());
    const { body: req } = await ask(cookie);
    await t.http().post(`/api/ppf/requests/${req.id}/reject`).set(bearer(amani)).send({ decisionNote: 'Workshop is full that day' });
    expect((await view(cookie)).body.requests[0]).toMatchObject({ status: 'REJECTED', decisionNote: 'Workshop is full that day' });
  });

  it('changing the PIN signs every phone out', async () => {
    await setPin();
    const old = cookieOf(await unlock());
    expect((await view(old)).status).toBe(200);
    await setPin('777777');
    const res = await view(old);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SALES_ACCESS_REQUIRED');
    expect((await unlock()).body.code).toBe('SALES_PIN_INVALID');
    expect((await view(cookieOf(await unlock('777777')))).status).toBe(200);
  });

  it('five wrong PINs lock unlocking; phones already unlocked keep working', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());
    for (let i = 0; i < 5; i++) expect((await unlock('000000')).status).toBe(401);
    const locked = await unlock();
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('SALES_PIN_LOCKED');
    expect(locked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect((await view(cookie)).status).toBe(200);
  });

  it('limits what sales can browse', async () => {
    await setPin();
    const cookie = cookieOf(await unlock());
    expect((await view(cookie, { from: qatarDay(-70), to: qatarDay(-40) })).body.code).toBe('BAD_RANGE');
    expect((await view(cookie, { from: today, to: '2031-02-30' })).status).toBe(400);
  });

  it('never writes the PIN to the activity log, and names the salesperson on requests', async () => {
    await setPin();
    await unlock('000000');
    const cookie = cookieOf(await unlock());
    await book({});
    await ask(cookie);
    const log = await t.prisma.activityLog.findMany({ orderBy: { id: 'asc' } });
    const text = JSON.stringify(log, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
    expect(text).not.toContain(PIN);
    expect(text).not.toContain('000000');
    expect(log.filter((l) => l.action === 'sales_access.unlock').map((l) => l.outcome)).toEqual(['FAILURE', 'SUCCESS']);
    const request = log.find((l) => l.action === 'ppf_request.create');
    expect(request).toMatchObject({ actorId: null, entityType: 'LightJobRequest', metadata: { salesName: 'Yousef' } });
  });
});
