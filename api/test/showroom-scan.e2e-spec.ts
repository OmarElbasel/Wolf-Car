import { createTestApp, type TestApp } from './utils/app';
import { bearer, showroomLogin } from './utils/auth';
import { PW, seedWorld, type World } from './utils/fixtures';

describe('Showroom: scanning from the screen (e2e)', () => {
  let t: TestApp;
  let world: World;
  beforeAll(async () => {
    t = await createTestApp();
    world = await seedWorld(t.prisma);
    await t.prisma.branch.update({ where: { id: world.bo.id }, data: { scanFromScreen: true } });
  });
  afterAll(async () => {
    await t.close();
  });

  const branchOf = async (username: string) => {
    const kiosk = await showroomLogin(t, username, PW.showroom);
    const res = await t.http().get('/api/showroom/products').set(bearer(kiosk.token));
    expect(res.status).toBe(200);
    return res.body.branch as { code: string; scanFromScreen: boolean };
  };

  it('tells the kiosk of a branch whose cashier scans barcodes off the screen', async () => {
    expect(await branchOf('bo.cashier')).toMatchObject({ code: 'BO', scanFromScreen: true });
  });

  it('leaves every other branch as it was', async () => {
    expect(await branchOf('gh.cashier')).toMatchObject({ code: 'GH', scanFromScreen: false });
  });
});
