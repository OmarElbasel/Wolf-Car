import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { AUDIT_KEY, type AuditOptions, SKIP_AUDIT_KEY } from '../common/decorators/audit.decorator';

export interface RouteInfo {
  method: string;
  path: string;
  controller: string;
  handler: string;
  audit?: AuditOptions;
  skipAudit?: string;
}

const join = (...parts: string[]) =>
  `/${parts
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/')}`;

/** Every HTTP route of the app with its audit metadata (used by the action registry and tests). */
export function listRoutes(discovery: DiscoveryService, scanner: MetadataScanner, reflector: Reflector, prefix = 'api'): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const base = (Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined) ?? '';
    const proto = Object.getPrototypeOf(instance) as object;
    for (const name of scanner.getAllMethodNames(proto)) {
      const handler = (proto as Record<string, unknown>)[name] as (...args: unknown[]) => unknown;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      const path = (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) ?? '';
      routes.push({
        method: RequestMethod[method],
        path: join(prefix, base, path),
        controller: metatype.name,
        handler: name,
        audit: reflector.get<AuditOptions | undefined>(AUDIT_KEY, handler),
        skipAudit: reflector.get<string | undefined>(SKIP_AUDIT_KEY, handler),
      });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
