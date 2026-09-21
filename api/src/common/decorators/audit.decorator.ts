import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit:action';
export const SKIP_AUDIT_KEY = 'audit:skip';

export interface AuditOptions {
  /** e.g. "product.update"; stored as the activity log's action */
  action: string;
  /** e.g. "Product"; stored as entity_type */
  entity?: string;
  /** route param holding the entity id (services may override via AuditTrail) */
  idParam?: string;
}

/**
 * Records the request in the activity log (success and failure). Every
 * mutating route must carry @Audit or @SkipAudit — a test enforces it.
 */
export const Audit = (action: string, options: Omit<AuditOptions, 'action'> = {}) =>
  SetMetadata(AUDIT_KEY, { action, ...options } satisfies AuditOptions);

/** Explicit opt-out for a mutating route, with the reason kept next to the code. */
export const SkipAudit = (reason: string) => SetMetadata(SKIP_AUDIT_KEY, reason);
