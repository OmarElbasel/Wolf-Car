import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { type Page, skipTake } from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListActivityQueryDto } from './dto/activity.dto';
import { listRoutes } from './route-inventory';

/** Actions written outside the interceptor. */
const EXTRA_ACTIONS = ['access.denied', 'auth.refresh.reuse_detected'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const qatarDay = (d: string) => new Date(`${d}T00:00:00+03:00`);

@Injectable()
export class ActivityQueryService implements OnApplicationBootstrap {
  private actions: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const fromRoutes = listRoutes(this.discovery, this.scanner, this.reflector)
      .map((r) => r.audit?.action)
      .filter((a): a is string => Boolean(a));
    this.actions = [...new Set([...fromRoutes, ...EXTRA_ACTIONS])].sort();
  }

  /** Every action the system can record, for the filter dropdown. */
  knownActions(): string[] {
    return this.actions;
  }

  async list(q: ListActivityQueryDto): Promise<Page<ReturnType<typeof view>>> {
    const and: Prisma.ActivityLogWhereInput[] = [];
    if (q.actorId) and.push({ actorId: q.actorId });
    if (q.actor) and.push({ actorUsername: { contains: q.actor.toLowerCase() } });
    if (q.branchId) and.push({ branchId: q.branchId });
    if (q.action) and.push(q.action.endsWith('.') ? { action: { startsWith: q.action } } : { action: q.action });
    if (q.entityType) and.push({ entityType: q.entityType });
    if (q.entityId) and.push({ entityId: q.entityId });
    if (q.outcome) and.push({ outcome: q.outcome });
    if (q.from) and.push({ occurredAt: { gte: DAY.test(q.from) ? qatarDay(q.from) : new Date(q.from) } });
    if (q.to) {
      and.push(
        DAY.test(q.to)
          ? { occurredAt: { lt: new Date(qatarDay(q.to).getTime() + 86_400_000) } }
          : { occurredAt: { lte: new Date(q.to) } },
      );
    }
    const where: Prisma.ActivityLogWhereInput = and.length ? { AND: and } : {};
    const [rows, total, branches] = await Promise.all([
      this.prisma.activityLog.findMany({ where, orderBy: { id: 'desc' }, ...skipTake(q) }),
      this.prisma.activityLog.count({ where }),
      this.prisma.branch.findMany({ select: { id: true, code: true, name: true, nameAr: true } }),
    ]);
    const byId = new Map(branches.map((b) => [b.id, b]));
    return {
      items: rows.map((r) => view(r, r.branchId ? (byId.get(r.branchId) ?? null) : null)),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  }
}

type Row = Prisma.ActivityLogGetPayload<object>;

function view(r: Row, branch: { id: string; code: string; name: string; nameAr: string } | null) {
  return {
    id: r.id.toString(),
    occurredAt: r.occurredAt,
    action: r.action,
    outcome: r.outcome,
    actor: r.actorId || r.actorUsername ? { id: r.actorId, username: r.actorUsername, role: r.actorRole } : null,
    branch,
    entityType: r.entityType,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    metadata: r.metadata,
    ip: r.ip,
    userAgent: r.userAgent,
    requestId: r.requestId,
  };
}
