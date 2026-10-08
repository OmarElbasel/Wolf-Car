import { Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { AuditTrail } from '../activity/audit-trail.service';
import { money } from '../common/money';
import type { AuthUser } from '../common/types';
import type { Prisma } from '../generated/prisma/client';
import { categoryTile } from '../odoo/category-image';
import { PrismaService } from '../prisma/prisma.service';
import { imageUrl, processAndStoreImage } from '../uploads/image-processing';
import { ImageUploadService } from '../uploads/image-upload.service';
import type { CreateServiceDto, UpdateServiceDto, UpdateTierDto } from './dto/services.dto';
import { BODIES, DEFAULT_SERVICES, DEFAULT_TIERS, lineName, SECTIONS, TIER_SETS, type Body, type TierSet } from './service-catalogue';

const TIER_SELECT = { id: true, set: true, nameAr: true, nameEn: true, position: true } as const;
const SERVICE_SELECT = {
  id: true,
  section: true,
  nameAr: true,
  nameEn: true,
  noteAr: true,
  noteEn: true,
  tierSet: true,
  bodySplit: true,
  position: true,
  isActive: true,
  prices: { select: { id: true, serviceTierId: true, serviceBody: true, price: true, imageKey: true, serviceTier: { select: { position: true } } } },
} as const;
type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof SERVICE_SELECT }>;

/** Arbitrary constant: serialises the first-run seeding across requests and instances. */
const SEED_LOCK = 20261008;

const bySection = (a: ServiceRow, b: ServiceRow) =>
  SECTIONS.indexOf(a.section as (typeof SECTIONS)[number]) - SECTIONS.indexOf(b.section as (typeof SECTIONS)[number]) || a.position - b.position;

function serviceView(s: ServiceRow, { pricedOnly }: { pricedOnly: boolean }) {
  // column order: package by package, sedan before SUV
  const column = (p: ServiceRow['prices'][number]) => (p.serviceTier?.position ?? 0) * 2 + (p.serviceBody === 'suv' ? 1 : 0);
  const prices = [...s.prices]
    .sort((a, b) => column(a) - column(b))
    .filter((p) => !pricedOnly || p.price !== null)
    .map((p) => ({ productId: p.id, tierId: p.serviceTierId, body: p.serviceBody as Body | null, price: money(p.price) }));
  return {
    id: s.id,
    section: s.section,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    noteAr: s.noteAr,
    noteEn: s.noteEn,
    tierSet: s.tierSet as TierSet | null,
    bodySplit: s.bodySplit,
    isActive: s.isActive,
    thumbUrl: s.prices[0] ? imageUrl(s.prices[0].imageKey, 'sm') : null,
    prices,
  };
}
export type ServiceView = ReturnType<typeof serviceView>;

/**
 * Services and packages (PPF, tint, polish, paint): kept here rather than in
 * Odoo and edited in the dashboard. Each price is a hidden product row, so a
 * service is ordered, shown to the cashier and printed like any part; its
 * price is changed through the products' own price endpoint, with history.
 */
@Injectable()
export class ServicesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServicesService.name);
  private seeded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageUploadService,
    private readonly trail: AuditTrail,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureSeeded();
    } catch (err) {
      // never keeps the API from starting; the first list() tries again
      this.logger.error(err, 'Could not write the starting services');
    }
  }

  /** Everything, for the dashboard: hidden services and unpriced cells included. */
  async list() {
    await this.ensureSeeded();
    return this.read({}, { pricedOnly: false });
  }

  /** What customers may order: active services and the prices that are set. */
  async publicList() {
    await this.ensureSeeded();
    const { tiers, services } = await this.read({ isActive: true }, { pricedOnly: true });
    return { tiers, services: services.filter((s) => s.prices.length > 0) };
  }

  async create(dto: CreateServiceDto, user: AuthUser): Promise<ServiceView> {
    const tiers = dto.tierSet ? await this.prisma.serviceTier.findMany({ where: { set: dto.tierSet }, orderBy: { position: 'asc' }, select: TIER_SELECT }) : [];
    const imageKey = (await this.prisma.product.findFirst({ where: { serviceId: { not: null } }, select: { imageKey: true } }))?.imageKey ?? (await this.tile());
    const last = await this.prisma.service.aggregate({ _max: { position: true } });
    const service = await this.prisma.service.create({
      data: {
        section: dto.section,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        tierSet: dto.tierSet ?? null,
        bodySplit: dto.bodySplit ?? false,
        position: (last._max.position ?? 0) + 1,
        // each cell starts without a price: Finance fills the row in
        prices: { create: cells(dto.nameAr, tiers, dto.bodySplit ?? false).map((c) => ({ ...c, imageKey, createdById: user.id })) },
      },
      select: SERVICE_SELECT,
    });
    const view = serviceView(service, { pricedOnly: false });
    this.trail.setEntity('Service', service.id).setChange(null, { nameAr: view.nameAr, nameEn: view.nameEn, section: view.section });
    return view;
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceView> {
    const before = await this.prisma.service.findUnique({ where: { id }, select: SERVICE_SELECT });
    if (!before) throw new NotFoundException('Service not found.');
    const after = await this.prisma.$transaction(async (tx) => {
      const row = await tx.service.update({ where: { id }, data: dto, select: SERVICE_SELECT });
      if (dto.nameAr !== undefined && dto.nameAr !== before.nameAr) await renameLines(tx, { serviceId: id });
      return row;
    });
    const details = (s: ServiceRow) => ({ nameAr: s.nameAr, nameEn: s.nameEn, noteAr: s.noteAr, noteEn: s.noteEn, isActive: s.isActive });
    this.trail.setEntity('Service', id).setChange(details(before), details(after));
    return serviceView(after, { pricedOnly: false });
  }

  /** Renames a package, film or car model: every service priced by it follows. */
  async updateTier(id: string, dto: UpdateTierDto) {
    const before = await this.prisma.serviceTier.findUnique({ where: { id }, select: TIER_SELECT });
    if (!before) throw new NotFoundException('Package not found.');
    const after = await this.prisma.$transaction(async (tx) => {
      const row = await tx.serviceTier.update({ where: { id }, data: dto, select: TIER_SELECT });
      if (dto.nameAr !== before.nameAr) await renameLines(tx, { serviceTierId: id });
      return row;
    });
    this.trail.setEntity('ServiceTier', id).setChange({ nameAr: before.nameAr, nameEn: before.nameEn }, { nameAr: after.nameAr, nameEn: after.nameEn });
    return after;
  }

  private async read(where: Prisma.ServiceWhereInput, options: { pricedOnly: boolean }) {
    const [tiers, services] = await Promise.all([
      this.prisma.serviceTier.findMany({ orderBy: [{ set: 'asc' }, { position: 'asc' }], select: TIER_SELECT }),
      this.prisma.service.findMany({ where, select: SERVICE_SELECT }),
    ]);
    return { tiers, services: services.sort(bySection).map((s) => serviceView(s, options)) };
  }

  /** One dark "Wolf Car" tile shared by every service: what a basket line shows beside its name. */
  private async tile(): Promise<string> {
    return processAndStoreImage(await categoryTile({ label: 'Wolf Car' }), this.images.uploadDir);
  }

  /**
   * Writes the accountant's sheet (service-catalogue.ts) the first time the
   * database has no service. The price rows need an author, so this waits for
   * the first user to exist.
   */
  private async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    if ((await this.prisma.service.count()) > 0) {
      this.seeded = true;
      return;
    }
    const author = await this.prisma.user.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!author) return;
    const imageKey = await this.tile();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_LOCK})`;
      if ((await tx.service.count()) > 0) return;

      const tiers = new Map<TierSet, { id: string; nameAr: string }[]>();
      for (const set of TIER_SETS) {
        const rows = [];
        for (const [position, t] of DEFAULT_TIERS[set].entries()) {
          rows.push(await tx.serviceTier.create({ data: { set, ...t, position }, select: { id: true, nameAr: true } }));
        }
        tiers.set(set, rows);
      }

      for (const [position, s] of DEFAULT_SERVICES.entries()) {
        const { prices, ...details } = s;
        const amounts = prices.flat();
        await tx.service.create({
          data: {
            ...details,
            position,
            prices: {
              create: cells(s.nameAr, s.tierSet ? (tiers.get(s.tierSet) ?? []) : [], s.bodySplit ?? false).map((c, i) => ({
                ...c,
                price: amounts[i],
                priceUpdatedAt: new Date(),
                imageKey,
                createdById: author.id,
              })),
            },
          },
        });
      }
      this.logger.log(`Wrote the starting catalogue of ${DEFAULT_SERVICES.length} services`);
    });
    this.seeded = true;
  }
}

/** One row per price of a service: tier by tier, sedan before SUV. */
function cells(nameAr: string, tiers: { id: string; nameAr: string }[], bodySplit: boolean) {
  const columns: ({ id: string; nameAr: string } | null)[] = tiers.length ? tiers : [null];
  const bodies: (Body | null)[] = bodySplit ? [...BODIES] : [null];
  return columns.flatMap((tier) =>
    bodies.map((body) => ({
      name: lineName(nameAr, tier?.nameAr ?? null, body),
      serviceTierId: tier?.id ?? null,
      serviceBody: body,
    })),
  );
}

/** Re-writes the order-line names of the prices a rename touches. Past orders keep the name they were placed with. */
async function renameLines(tx: Prisma.TransactionClient, where: { serviceId: string } | { serviceTierId: string }): Promise<void> {
  const rows = await tx.product.findMany({
    where,
    select: { id: true, serviceBody: true, service: { select: { nameAr: true } }, serviceTier: { select: { nameAr: true } } },
  });
  for (const p of rows) {
    await tx.product.update({ where: { id: p.id }, data: { name: lineName(p.service?.nameAr ?? '', p.serviceTier?.nameAr ?? null, p.serviceBody) } });
  }
}
