/**
 * Imports the legacy Supabase catalogue export (categories_rows.csv and
 * products_rows.csv) into this database.
 *
 *   npm run db:import-legacy -- [--dir "../old products data"] [--force-images]
 *
 * Unlike the seed, this NEVER wipes anything. Rows are keyed on their legacy
 * primary keys (`cat-…`, `prod-…`), so re-running updates what is already
 * there instead of creating duplicates. Product images are only re-encoded for
 * rows that do not have one yet, unless --force-images is passed. Category
 * images are always redone (there are only a handful), so a change to how
 * they are prepared reaches rows imported before it.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaClient } from '../src/generated/prisma/client';
import { parseCsv } from '../src/legacy-import/csv';
import {
  normaliseCategory,
  normaliseProduct,
  type LegacyProduct,
} from '../src/legacy-import/legacy-rows';
import { createPgAdapter } from '../src/prisma/pg-adapter';
import { deleteStoredImage, processAndStoreImage } from '../src/uploads/image-processing';

try {
  process.loadEnvFile('.env');
} catch {
  /* env comes from the process */
}

const IMPORT_USERNAME = 'system.import';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const dir = path.resolve(arg('dir') ?? '../old products data');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './storage/uploads');
  const forceImages = hasFlag('force-images');

  const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
  const warnings: string[] = [];

  try {
    console.log(`Reading CSVs from ${dir}`);
    const [categoryCsv, productCsv] = await Promise.all([
      readFile(path.join(dir, 'categories_rows.csv'), 'utf8'),
      readFile(path.join(dir, 'products_rows.csv'), 'utf8'),
    ]);

    const categoryRows = parseCsv(categoryCsv).map(normaliseCategory);
    const productRows = parseCsv(productCsv).map(normaliseProduct);
    console.log(`Parsed ${categoryRows.length} categories and ${productRows.length} products`);

    // the catalogue has to belong to someone: Product.createdById is required
    const importer = await prisma.user.upsert({
      where: { username: IMPORT_USERNAME },
      update: {},
      create: {
        username: IMPORT_USERNAME,
        displayName: 'Legacy catalogue import',
        role: 'SUPER_ADMIN',
        // no usable password hash: this account exists for attribution only
        passwordHash: 'x'.repeat(97),
        isActive: false,
      },
      select: { id: true },
    });

    // ---- categories -------------------------------------------------------
    const categoryIdByLegacy = new Map<string, string>();
    for (const c of categoryRows) {
      const existing = await prisma.category.findUnique({
        where: { legacyId: c.legacyId },
        select: { id: true, imageKey: true },
      });
      let imageKey = existing?.imageKey ?? null;
      if (c.image) {
        imageKey = await processAndStoreImage(await trimMargins(c.image.data), uploadDir);
        if (existing?.imageKey) await deleteStoredImage(existing.imageKey, uploadDir);
      }
      const data = { name: c.name, nameEn: c.nameEn, carModel: c.carModel, position: c.position, imageKey };
      const saved = existing
        ? await prisma.category.update({ where: { id: existing.id }, data, select: { id: true } })
        : await prisma.category.create({ data: { ...data, legacyId: c.legacyId }, select: { id: true } });
      categoryIdByLegacy.set(c.legacyId, saved.id);
    }
    console.log(`Categories: ${categoryIdByLegacy.size}`);

    // ---- products ---------------------------------------------------------
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const productIds: string[] = [];

    for (const [i, p] of productRows.entries()) {
      for (const w of p.warnings) warnings.push(`${p.legacyId} (${p.name}): ${w}`);

      const categoryId = categoryIdByLegacy.get(p.categoryLegacyId) ?? null;
      if (!categoryId) warnings.push(`${p.legacyId}: unknown category ${p.categoryLegacyId}`);

      const existing = await prisma.product.findUnique({
        where: { legacyId: p.legacyId },
        select: { id: true, imageKey: true },
      });

      let imageKey = existing?.imageKey ?? null;
      if (p.image && (forceImages || !imageKey)) {
        try {
          imageKey = await processAndStoreImage(p.image.data, uploadDir);
        } catch (err) {
          warnings.push(`${p.legacyId}: image could not be processed (${(err as Error).message})`);
        }
      }
      if (!imageKey) {
        // imageKey is NOT NULL and a product without a picture is useless on the kiosk
        warnings.push(`${p.legacyId} (${p.name}): SKIPPED — no usable image`);
        skipped++;
        continue;
      }

      const saved = await upsertProduct(prisma, p, { categoryId, imageKey, importerId: importer.id, existing });
      productIds.push(saved.id);
      if (existing) updated++;
      else created++;

      if ((i + 1) % 200 === 0) console.log(`  …${i + 1}/${productRows.length}`);
    }
    console.log(`Products: ${created} created, ${updated} updated, ${skipped} skipped`);

    // ---- showroom placement ----------------------------------------------
    const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true } });
    for (const branch of branches) {
      const placed = await placeInBranch(prisma, branch.id, productIds);
      console.log(`Branch ${branch.code}: ${placed} products placed`);
    }

    console.log('\nDone.');
    if (warnings.length) {
      console.log(`\n${warnings.length} warning(s):`);
      for (const w of warnings.slice(0, 40)) console.log(`  - ${w}`);
      if (warnings.length > 40) console.log(`  …and ${warnings.length - 40} more`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Crops the empty (transparent or flat-colour) border off a car photo. Some
 * legacy uploads are square canvases with the car small in the middle, which
 * made those cards look zoomed out next to the tightly cropped ones.
 */
async function trimMargins(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).trim({ threshold: 12 }).png().toBuffer();
  } catch {
    return input; // nothing to trim (a flat image) — keep it as it is
  }
}

async function upsertProduct(
  prisma: PrismaClient,
  p: LegacyProduct,
  ctx: { categoryId: string | null; imageKey: string; importerId: string; existing: { id: string } | null },
) {
  const data = {
    name: p.name,
    barcode: p.barcode,
    categoryId: ctx.categoryId,
    imageKey: ctx.imageKey,
    price: p.price,
    priceUpdatedAt: p.price ? new Date() : null,
  };
  return ctx.existing
    ? prisma.product.update({ where: { id: ctx.existing.id }, data, select: { id: true } })
    : prisma.product.create({
        data: { ...data, legacyId: p.legacyId, createdById: ctx.importerId },
        select: { id: true },
      });
}

/**
 * Appends every imported product to the branch's showroom order, keeping the
 * positions already chosen by the branch manager. Runs in one transaction so
 * the deferred unique (branch_id, position) constraint is checked at commit.
 */
async function placeInBranch(prisma: PrismaClient, branchId: string, productIds: string[]): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.branchProduct.findMany({
      where: { branchId },
      select: { productId: true, position: true },
    });
    const known = new Set(existing.map((e) => e.productId));
    let next = existing.reduce((max, e) => Math.max(max, e.position), -1) + 1;

    const rows = productIds
      .filter((id) => !known.has(id))
      .map((productId) => ({ branchId, productId, position: next++ }));
    if (rows.length) await tx.branchProduct.createMany({ data: rows });
    return rows.length;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
