/**
 * Demo data: one Super Admin, one Finance user and two branches (Bin Omran, Al
 * Gharrafa) each with a manager and a cashier. Wipes the database first —
 * development only. The real catalogue comes from the legacy import, which
 * db:reset runs straight after this.
 *
 * SEED_DEMO_CATALOG=1 also adds made-up products with generated images and a
 * few orders. Only the Playwright suite sets it; they must never reach a real
 * database, where they would show up on the public website.
 *
 *   npm run db:seed          (or: npm run db:reset — migrate + seed + legacy import)
 */
import { createPgAdapter } from '../src/prisma/pg-adapter';
import sharp from 'sharp';
import { Prisma, PrismaClient, type Role } from '../src/generated/prisma/client';
import { PasswordService } from '../src/auth/password.service';
import { syncPermissionCatalog } from '../src/rbac/permission-catalog';
import { processAndStoreImage } from '../src/uploads/image-processing';

try {
  process.loadEnvFile('.env');
} catch {
  /* env comes from the process */
}

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production. The seed wipes all data.');
  process.exit(1);
}

export const SEED_PASSWORDS = {
  admin: 'SuperWolf#2026!',
  finance: 'Ledger#Wolf2026!',
  manager: 'Manager#Wolf2026!',
  cashier: 'Cashier#Wolf2026!',
  showroom: 'Showroom#2026!',
} as const;

const BRANCHES = [
  { code: 'BO', name: 'Bin Omran Branch', nameAr: 'فرع بن عمران', slug: 'bo', label: 'Bin Omran' },
  { code: 'GH', name: 'Al Gharrafa Branch', nameAr: 'فرع الغرافة', slug: 'gh', label: 'Al Gharrafa' },
] as const;

interface SeedProduct {
  name: string;
  description: string | null;
  barcode: string | null;
  price: string | null;
  badge: string;
  color: string;
}

const PRODUCTS: SeedProduct[] = [
  { name: 'PPF Paint Protection Film — Front Kit', description: 'Self-healing clear film for the bonnet, bumper, mirrors and headlights. Installed in our workshop.', barcode: '6291041500213', price: '1800.00', badge: 'PPF', color: '#d9541a' },
  { name: 'Ceramic Coating 9H', description: 'Two-layer ceramic protection with a deep gloss finish and easy cleaning.', barcode: '6291041500220', price: '950.00', badge: '9H', color: '#161616' },
  { name: 'Nano Ceramic Window Tint', description: 'Heat-rejecting tint for all side and rear windows.', barcode: '6291041500237', price: '650.00', badge: 'TINT', color: '#474747' },
  { name: '4K Dash Cam (Front & Rear)', description: 'Wide-angle 4K front camera with 1080p rear camera and parking mode.', barcode: '6291041500244', price: '499.00', badge: 'CAM', color: '#b8420f' },
  { name: 'LED Headlight Bulbs H7', description: 'Bright white 6000K LED bulbs, plug-and-play.', barcode: '6291041500251', price: '180.00', badge: 'LED', color: '#161616' },
  { name: 'غطاء مقاعد جلد', description: 'أغطية مقاعد من الجلد الصناعي الفاخر، مفصّلة حسب موديل السيارة.', barcode: '6291041500268', price: '1200.00', badge: 'SEAT', color: '#6e6e6e' },
  { name: '3D Floor Mats', description: 'Waterproof custom-fit floor mats with raised edges.', barcode: null, price: '320.00', badge: 'MAT', color: '#474747' },
  { name: 'Engine Oil 5W-30 (4 L)', description: 'Fully synthetic engine oil for petrol engines.', barcode: '6291041500282', price: '145.50', badge: 'OIL', color: '#d9541a' },
  { name: 'Oil Filter', description: null, barcode: '6291041500299', price: '35.00', badge: 'FLT', color: '#161616' },
  { name: 'Brake Pads — Front Set', description: 'Low-dust ceramic brake pads.', barcode: '6291041500305', price: '280.00', badge: 'BRK', color: '#b8420f' },
  { name: 'عطر سيارة فاخر', description: 'معطر سيارة برائحة العود يدوم حتى 60 يومًا.', barcode: null, price: '45.00', badge: 'AIR', color: '#6e6e6e' },
  // left without a price so the Finance "needs a price" queue has something to show
  { name: 'Wireless Phone Holder', description: 'Magnetic wireless-charging phone mount for air vents.', barcode: '6291041500312', price: null, badge: 'PHN', color: '#474747' },
  { name: 'Wheel Rim Cleaner', description: 'Acid-free cleaner for alloy wheels.', barcode: null, price: null, badge: 'RIM', color: '#161616' },
];

async function placeholderImage(badge: string, color: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
    <rect width="1200" height="1200" fill="#f5f4f1"/>
    <rect x="150" y="150" width="900" height="900" rx="48" fill="${color}"/>
    <text x="600" y="660" font-family="Helvetica, Arial, sans-serif" font-size="${badge.length > 3 ? 200 : 260}"
      font-weight="700" fill="#ffffff" text-anchor="middle">${badge}</text>
    <text x="600" y="1110" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700"
      letter-spacing="10" fill="#9c968c" text-anchor="middle">WOLF CAR</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const uploadDir = process.env.UPLOAD_DIR ?? './storage/uploads';
  const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
  const passwords = new PasswordService();

  try {
    console.log('Wiping existing data…');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE activity_logs, order_items, orders, price_history, branch_products, products, categories, ' +
        'refresh_tokens, sessions, recovery_codes, user_permission_overrides, role_permissions, permissions, users, branches ' +
        'RESTART IDENTITY CASCADE',
    );

    await syncPermissionCatalog(prisma);

    const hash = {
      admin: await passwords.hash(SEED_PASSWORDS.admin),
      finance: await passwords.hash(SEED_PASSWORDS.finance),
      manager: await passwords.hash(SEED_PASSWORDS.manager),
      cashier: await passwords.hash(SEED_PASSWORDS.cashier),
      showroom: await passwords.hash(SEED_PASSWORDS.showroom),
    };

    const admin = await prisma.user.create({
      data: { username: 'admin', displayName: 'System Administrator', role: 'SUPER_ADMIN', passwordHash: hash.admin },
    });
    const finance = await prisma.user.create({
      data: {
        username: 'finance',
        displayName: 'Finance Team',
        role: 'FINANCE',
        passwordHash: hash.finance,
        createdById: admin.id,
      },
    });

    const branches: SeededBranch[] = [];
    for (const b of BRANCHES) {
      // branch + its two staff in one transaction: the staffing constraint is checked at commit
      const created = await prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({ data: { code: b.code, name: b.name, nameAr: b.nameAr } });
        const staff = async (role: Role, title: string, pw: string) =>
          tx.user.create({
            data: {
              username: `${b.slug}.${role === 'BRANCH_MANAGER' ? 'manager' : 'cashier'}`,
              displayName: `${b.label} ${title}`,
              role,
              branchId: branch.id,
              passwordHash: pw,
              showroomPasswordHash: hash.showroom,
              createdById: admin.id,
            },
          });
        const manager = await staff('BRANCH_MANAGER', 'Manager', hash.manager);
        const cashier = await staff('CASHIER', 'Cashier', hash.cashier);
        return { id: branch.id, code: branch.code, managerId: manager.id, cashierId: cashier.id };
      });
      branches.push(created);
    }

    if (process.env.SEED_DEMO_CATALOG === '1') await seedDemoCatalog(prisma, uploadDir, branches, finance.id);
    else console.log('No demo products (catalogue comes from: npm run db:import-legacy)');

    console.log('\nSeed complete. Demo accounts (dashboard password / showroom password):');
    console.table([
      { username: 'admin', role: 'SUPER_ADMIN', password: SEED_PASSWORDS.admin, showroom: '—' },
      { username: 'finance', role: 'FINANCE', password: SEED_PASSWORDS.finance, showroom: '—' },
      ...BRANCHES.flatMap((b) => [
        { username: `${b.slug}.manager`, role: 'BRANCH_MANAGER', password: SEED_PASSWORDS.manager, showroom: SEED_PASSWORDS.showroom },
        { username: `${b.slug}.cashier`, role: 'CASHIER', password: SEED_PASSWORDS.cashier, showroom: SEED_PASSWORDS.showroom },
      ]),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

type SeededBranch = { id: string; code: string; managerId: string; cashierId: string };

/** Made-up products and orders for the Playwright suite (SEED_DEMO_CATALOG=1). */
async function seedDemoCatalog(
  prisma: PrismaClient,
  uploadDir: string,
  branches: SeededBranch[],
  financeId: string,
): Promise<void> {
  console.log('Generating demo product images…');
  const products: { id: string; name: string; price: Prisma.Decimal | null }[] = [];
  for (const [i, p] of PRODUCTS.entries()) {
    const imageKey = await processAndStoreImage(await placeholderImage(p.badge, p.color), uploadDir);
    const creator = branches[i % branches.length].managerId;
    const product = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        imageKey,
        createdById: creator,
        ...(p.price
          ? {
              price: p.price,
              priceUpdatedAt: new Date(),
              priceHistory: { create: { oldPrice: null, newPrice: p.price, changedById: financeId } },
            }
          : {}),
      },
      select: { id: true, name: true, price: true },
    });
    products.push(product);
  }

  // each branch shows the catalogue in its own order (Al Gharrafa reversed, to make the difference visible)
  for (const [bi, branch] of branches.entries()) {
    const ordered = bi === 0 ? products : [...products].reverse();
    await prisma.branchProduct.createMany({
      data: ordered.map((p, position) => ({ branchId: branch.id, productId: p.id, position })),
    });
  }

  console.log('Creating sample orders…');
  const priced = products.filter((p) => p.price !== null);
  const sample = [
    { customer: 'Mohammed Al-Kuwari', lines: [[0, 1], [4, 2]], status: 'CONFIRMED' },
    { customer: 'سارة المنصوري', lines: [[7, 2], [8, 2], [10, 1]], status: 'PENDING' },
    { customer: 'Rashid Hassan', lines: [[3, 1]], status: 'PENDING' },
  ] as const;
  for (const branch of branches) {
    for (const s of sample) {
      await prisma.$transaction(async (tx) => {
        const { orderSeq } = await tx.branch.update({
          where: { id: branch.id },
          data: { orderSeq: { increment: 1 } },
          select: { orderSeq: true },
        });
        const items = s.lines.map(([idx, quantity], position) => {
          const product = priced[idx];
          const unitPrice = product.price as Prisma.Decimal;
          return {
            productId: product.id,
            productName: product.name,
            unitPrice,
            quantity,
            lineTotal: unitPrice.mul(quantity),
            position,
          };
        });
        const total = items.reduce((sum, i) => sum.add(i.lineTotal), new Prisma.Decimal(0));
        await tx.order.create({
          data: {
            branchId: branch.id,
            number: orderSeq,
            code: `${branch.code}-${String(orderSeq).padStart(6, '0')}`,
            customerName: s.customer,
            status: s.status,
            total,
            createdById: branch.managerId,
            ...(s.status === 'CONFIRMED' ? { confirmedById: branch.cashierId, confirmedAt: new Date() } : {}),
            items: { create: items },
          },
        });
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
