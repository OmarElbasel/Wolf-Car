import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { AuditOutcome, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toAuditJson } from './redact';

export interface ActivityEntry {
  action: string;
  outcome: AuditOutcome;
  actorId?: string | null;
  actorUsername?: string | null;
  actorRole?: Role | null;
  branchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const json = (v: unknown) => {
  const safe = toAuditJson(v);
  return safe === null ? Prisma.DbNull : (safe as Prisma.InputJsonValue);
};

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Appends one entry. Never throws: a logging failure must not fail the user's request. */
  async record(entry: ActivityEntry): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          action: entry.action,
          outcome: entry.outcome,
          actorId: entry.actorId ?? null,
          actorUsername: entry.actorUsername?.slice(0, 40) ?? null,
          actorRole: entry.actorRole ?? null,
          branchId: entry.branchId ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          before: json(entry.before),
          after: json(entry.after),
          metadata: json(entry.metadata),
          ip: entry.ip?.slice(0, 64) ?? null,
          userAgent: entry.userAgent?.slice(0, 512) ?? null,
          requestId: entry.requestId ?? null,
        },
      });
    } catch (err) {
      this.logger.error({ err, action: entry.action }, 'Failed to write activity log entry');
    }
  }
}
