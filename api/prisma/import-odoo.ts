/**
 * Fills the catalogue from the company's Odoo.
 *
 *   npm run db:import-odoo -- [--dry-run] [--hide-legacy] [--force-images]
 *
 * Read-only towards Odoo, and it never deletes anything here. Products are
 * keyed on the Odoo variant id, so re-running updates rows instead of
 * duplicating them. A product that Odoo no longer offers (archived, or
 * repriced to 0 or 1) is switched off, not removed.
 *
 *   --dry-run       show what would happen, write nothing
 *   --hide-legacy   switch off every product that did not come from Odoo
 *   --force-images  fetch every image again, not only for new products
 */
import { randomUUID } from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client';
import { OdooClient, odooConfigFromEnv } from '../src/odoo/odoo-client';
import { categoryName, legacyCategoryKey, skipReason, toProduct, VARIANT_FIELDS, type OdooProduct, type OdooVariant } from '../src/odoo/odoo-rows';
import { placeInBranch } from '../src/odoo/place-in-branch';
import { placeholderImage } from '../src/odoo/placeholder-image';
import { createPgAdapter } from '../src/prisma/pg-adapter';
import { deleteStoredImage, processAndStoreImage } from '../src/uploads/image-processing';

try {
  process.loadEnvFile('.env');
} catch {
  /* env comes from the process */
}

const IMPORT_USERNAME = 'system.odoo';
const IMAGE_BATCH = 25;
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const dryRun = hasFlag('dry-run');
  const hideLegacy = hasFlag('hide-legacy');
  const forceImages = hasFlag('force-images');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './storage/uploads');

  const config = odooConfigFromEnv(process.env);
  const odoo = new OdooClient(config);
  console.log(`Reading products from ${config.url} (database ${config.db})`);

  // ---- read everything from Odoo before touching the database --------------
  // archived variants are left out by Odoo itself; ar_001 gives the Arabic name
  // where one exists, and display_default_code drops the "[PROD-001]" prefix
  const variants = await odoo.searchRead<OdooVariant>('product.product', [], VARIANT_FIELDS, {
    lang: 'ar_001',
    display_default_code: false,
  });
  const skipped = new Map<string, number>();
  const products: OdooProduct[] = [];
  for (const v of variants) {
    const reason = skipReason(v);
    if (reason) skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
    else products.push(toProduct(v));
  }
  console.log(`Odoo has ${variants.length} variants: ${products.length} to import, ${variants.length - products.length} left out`);
  for (const [reason, n] of [...skipped].sort((a, b) => b[1] - a[1])) console.log(`  - ${n} ${reason}`);

  const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
  const warnings: string[] = [];
  try {
    const existing = new Map(
      (await prisma.product.findMany({ where: { odooId: { not: null } }, select: { id: true, odooId: true, imageKey: true, price: true } })).map(
        (p) => [p.odooId as number, p],
      ),
    );
    const wanted = new Set(products.map((p) => p.odooId));
    const stale = [...existing.values()].filter((p) => !wanted.has(p.odooId as number));
    const legacyCount = await prisma.product.count({ where: { odooId: null, isActive: true } });

    if (dryRun) {
      console.log('\nDry run — nothing was written.');
      console.log(`  would create ${products.filter((p) => !existing.has(p.odooId)).length} products`);
      console.log(`  would update ${products.filter((p) => existing.has(p.odooId)).length} products`);
      console.log(`  would switch off ${stale.length} products Odoo no longer offers`);
      if (hideLegacy) console.log(`  would hide ${legacyCount} products that did not come from Odoo`);
      for (const p of products.slice(0, 10)) console.log(`  e.g. ${p.price.padStart(10)}  ${p.barcode ?? '-'}  ${p.name}`);
      return;
    }

    // ---- images (files only; still no database writes) ---------------------
    const needImage = products.filter((p) => forceImages || !existing.has(p.odooId)).map((p) => p.odooId);
    const imageKeys = new Map<number, string>();
    const placeholder = await placeholderImage();
    let withPhoto = 0;
    for (let i = 0; i < needImage.length; i += IMAGE_BATCH) {
      const ids = needImage.slice(i, i + IMAGE_BATCH);
      const rows = await odoo.read<{ id: number; image_1920: string | false }>('product.product', ids, ['image_1920']);
      const byId = new Map(rows.map((r) => [r.id, r.image_1920]));
      for (const id of ids) {
        const b64 = byId.get(id);
        let key: string | undefined;
        if (b64) {
          try {
            key = await processAndStoreImage(Buffer.from(b64, 'base64'), uploadDir);
            withPhoto++;
          } catch (err) {
            warnings.push(`odoo ${id}: image could not be processed (${(err as Error).message}); placeholder used`);
          }
        }
        imageKeys.set(id, key ?? (await processAndStoreImage(placeholder, uploadDir)));
      }
      console.log(`  images …${Math.min(i + IMAGE_BATCH, needImage.length)}/${needImage.length}`);
    }
    console.log(`Images: ${withPhoto} from Odoo, ${needImage.length - withPhoto} placeholders`);

    // ---- database ----------------------------------------------------------
    // the catalogue has to belong to someone: Product.createdById is required
    const importer = await prisma.user.upsert({
      where: { username: IMPORT_USERNAME },
      update: {},
      create: {
        username: IMPORT_USERNAME,
        displayName: 'Odoo catalogue import',
        role: 'SUPER_ADMIN',
        // no usable password hash: this account exists for attribution only
        passwordHash: 'x'.repeat(97),
        isActive: false,
      },
      select: { id: true },
    });

    // categories: created once, then left alone so a name or image set in the dashboard survives.
    // One for a car the old catalogue already had takes over that car's Arabic name and photo.
    const legacyByKey = new Map(
      (
        await prisma.category.findMany({
          where: { odooId: null, imageKey: { not: null } },
          select: { name: true, nameEn: true, carModel: true, imageKey: true },
        })
      ).map((c) => [legacyCategoryKey(c.nameEn ?? c.name), c]),
    );
    let adopted = 0;
    const categoryIdByOdoo = new Map<number, string>();
    const paths = new Map<number, string>();
    for (const p of products) if (p.categoryOdooId !== null && p.categoryPath) paths.set(p.categoryOdooId, p.categoryPath);
    let position = ((await prisma.category.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1;
    for (const [odooId, categoryPath] of [...paths].sort((a, b) => a[1].localeCompare(b[1]))) {
      const found = await prisma.category.findUnique({ where: { odooId }, select: { id: true, imageKey: true } });
      const name = categoryName(categoryPath);
      const legacy = legacyByKey.get(legacyCategoryKey(name));
      if (legacy?.imageKey && !found?.imageKey) {
        // its own copy of the files, so neither category can remove the other's photo
        const imageKey = randomUUID();
        for (const suffix of ['', '-sm']) {
          await copyFile(path.join(uploadDir, `${legacy.imageKey}${suffix}.webp`), path.join(uploadDir, `${imageKey}${suffix}.webp`));
        }
        const data = { name: legacy.name, nameEn: legacy.nameEn ?? name, carModel: legacy.carModel, imageKey };
        const saved = found
          ? await prisma.category.update({ where: { id: found.id }, data, select: { id: true } })
          : await prisma.category.create({ data: { ...data, odooId, position: position++ }, select: { id: true } });
        categoryIdByOdoo.set(odooId, saved.id);
        adopted++;
        continue;
      }
      const saved =
        found ??
        (await prisma.category.create({
          data: { odooId, name, nameEn: /[؀-ۿ]/.test(name) ? null : name, carModel: name, position: position++ },
          select: { id: true },
        }));
      categoryIdByOdoo.set(odooId, saved.id);
    }
    console.log(`Categories: ${categoryIdByOdoo.size} (${adopted} took the name and photo of an old category)`);

    let created = 0;
    let updated = 0;
    let repriced = 0;
    const createdIds: string[] = [];
    const replacedImages: string[] = [];
    for (const [i, p] of products.entries()) {
      for (const w of p.warnings) warnings.push(`odoo ${p.odooId} (${p.name}): ${w}`);
      const categoryId = p.categoryOdooId === null ? null : (categoryIdByOdoo.get(p.categoryOdooId) ?? null);
      const before = existing.get(p.odooId);
      const newKey = imageKeys.get(p.odooId);

      if (!before) {
        const row = await prisma.product.create({
          data: {
            odooId: p.odooId,
            name: p.name,
            barcode: p.barcode,
            categoryId,
            imageKey: newKey as string,
            price: p.price,
            priceUpdatedAt: new Date(),
            createdById: importer.id,
            priceHistory: { create: { oldPrice: null, newPrice: p.price, changedById: importer.id } },
          },
          select: { id: true },
        });
        createdIds.push(row.id);
        created++;
      } else {
        const priceChanged = before.price === null || before.price.toFixed(2) !== p.price;
        await prisma.product.update({
          where: { id: before.id },
          data: {
            name: p.name,
            barcode: p.barcode,
            categoryId,
            isActive: true,
            updatedById: importer.id,
            ...(newKey ? { imageKey: newKey } : {}),
            ...(priceChanged
              ? {
                  price: p.price,
                  priceUpdatedAt: new Date(),
                  priceHistory: { create: { oldPrice: before.price, newPrice: p.price, changedById: importer.id } },
                }
              : {}),
          },
        });
        if (newKey) replacedImages.push(before.imageKey);
        if (priceChanged) repriced++;
        updated++;
      }
      if ((i + 1) % 200 === 0) console.log(`  …${i + 1}/${products.length}`);
    }
    for (const key of replacedImages) await deleteStoredImage(key, uploadDir);
    console.log(`Products: ${created} created, ${updated} updated (${repriced} repriced)`);

    if (stale.length) {
      await prisma.product.updateMany({ where: { id: { in: stale.map((p) => p.id) } }, data: { isActive: false } });
    }
    console.log(`Switched off ${stale.length} products Odoo no longer offers`);

    if (hideLegacy) {
      const hidden = await prisma.product.updateMany({ where: { odooId: null, isActive: true }, data: { isActive: false } });
      const emptied = await prisma.category.updateMany({
        where: { isActive: true, products: { none: { isActive: true } } },
        data: { isActive: false },
      });
      console.log(`Hidden: ${hidden.count} legacy products, ${emptied.count} categories left without products`);
    }

    const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true } });
    for (const branch of branches) {
      console.log(`Branch ${branch.code}: ${await placeInBranch(prisma, branch.id, createdIds)} products placed`);
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

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
