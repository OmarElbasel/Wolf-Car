import { BadRequestException, ConflictException, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import type { Env } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OdooClient } from './odoo-client';
import { syncOdooCatalogue, type OdooReader, type SyncSummary } from './odoo-sync';

const RUN_SELECT = { id: true, startedAt: true, finishedAt: true, trigger: true, ok: true, summary: true, error: true } as const;
type RunRow = Prisma.OdooSyncRunGetPayload<{ select: typeof RUN_SELECT }>;

/** What a finished run stores: the sync's numbers, and when the key that ran it expires. */
type StoredSummary = SyncSummary & { keyExpiresAt?: string | null };

/** A run as the dashboard shows it: the numbers, never the warnings' product names in bulk. */
function runView(run: RunRow) {
  const s = run.summary as unknown as StoredSummary | null;
  return {
    id: run.id,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    byUser: run.trigger !== 'schedule',
    ok: run.ok,
    error: run.error,
    summary: s
      ? { imported: s.imported, created: s.created, updated: s.updated, repriced: s.repriced, switchedOff: s.switchedOff, warnings: s.warnings.length }
      : null,
  };
}
export type OdooRunView = ReturnType<typeof runView>;

/**
 * Keeps the catalogue in line with Odoo: on a timer, and when someone asks.
 * One run at a time; a run that fails changes nothing and the next one tries again.
 */
@Injectable()
export class OdooSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OdooSyncService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const minutes = this.config.get('ODOO_SYNC_MINUTES', { infer: true });
    if (!this.reader() || minutes === 0 || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setInterval(() => void this.scheduled(), minutes * 60_000);
    // never keeps the process alive on shutdown
    this.timer.unref();
    this.logger.log(`Catalogue sync from Odoo every ${minutes} min`);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** The Odoo connection, or null when the four ODOO_* settings are not all present. */
  protected reader(): OdooReader | null {
    const url = this.config.get('ODOO_URL', { infer: true });
    const db = this.config.get('ODOO_DB', { infer: true });
    const login = this.config.get('ODOO_LOGIN', { infer: true });
    const apiKey = this.config.get('ODOO_API_KEY', { infer: true });
    return url && db && login && apiKey ? new OdooClient({ url: url.replace(/\/+$/, ''), db, login, apiKey }) : null;
  }

  private async scheduled(): Promise<void> {
    if (this.running) return; // the previous run is still going: skip this tick
    try {
      await this.run('schedule');
    } catch {
      /* recorded in odoo_sync_runs and logged by run() */
    }
  }

  /** Runs one sync and records it. `trigger` is "schedule" or the id of the user who asked. */
  async run(trigger: string): Promise<OdooRunView> {
    const odoo = this.reader();
    if (!odoo) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', code: 'ODOO_NOT_CONFIGURED', message: 'Odoo is not connected yet.' });
    }
    if (this.running) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', code: 'ODOO_SYNC_RUNNING', message: 'A sync is already running.' });
    }
    this.running = true;
    const { id } = await this.prisma.odooSyncRun.create({ data: { trigger }, select: { id: true } });
    try {
      const summary = await syncOdooCatalogue(this.prisma, odoo, {
        uploadDir: path.resolve(this.config.get('UPLOAD_DIR', { infer: true })),
      });
      if (summary.created || summary.updated || summary.switchedOff) {
        this.logger.log(`Odoo sync: ${summary.created} created, ${summary.updated} updated, ${summary.switchedOff} switched off`);
      }
      const stored: StoredSummary = { ...summary, keyExpiresAt: await this.keyExpiresAt(odoo) };
      return runView(
        await this.prisma.odooSyncRun.update({
          where: { id },
          data: { finishedAt: new Date(), ok: true, summary: stored as unknown as Prisma.InputJsonValue },
          select: RUN_SELECT,
        }),
      );
    } catch (err) {
      const error = ((err as Error).message ?? 'unknown error').slice(0, 600);
      this.logger.error(`Odoo sync failed: ${error}`);
      await this.prisma.odooSyncRun.update({ where: { id }, data: { finishedAt: new Date(), ok: false, error } });
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', code: 'ODOO_SYNC_FAILED', message: error });
    } finally {
      this.running = false;
    }
  }

  /** Asked after every good run so the dashboard can warn in time; never fails the run. */
  private async keyExpiresAt(odoo: OdooReader): Promise<string | null | undefined> {
    try {
      return (await odoo.keyExpiresAt?.())?.toISOString() ?? null;
    } catch (err) {
      this.logger.warn(`Could not read when the Odoo API key expires: ${(err as Error).message}`);
      return undefined;
    }
  }

  async status() {
    const [last, lastOk] = await Promise.all([
      this.prisma.odooSyncRun.findFirst({ where: { finishedAt: { not: null } }, orderBy: { startedAt: 'desc' }, select: RUN_SELECT }),
      this.prisma.odooSyncRun.findFirst({ where: { ok: true }, orderBy: { startedAt: 'desc' }, select: RUN_SELECT }),
    ]);
    const keyExpiresAt = (lastOk?.summary as unknown as StoredSummary | null)?.keyExpiresAt ?? null;
    return {
      configured: this.reader() !== null,
      running: this.running,
      everyMinutes: this.config.get('ODOO_SYNC_MINUTES', { infer: true }),
      /** when the API key stops working, as of the last good run; null when unknown or never */
      keyExpiresAt,
      last: last ? runView(last) : null,
      lastOk: lastOk ? runView(lastOk) : null,
    };
  }
}
