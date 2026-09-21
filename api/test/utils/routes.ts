import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { listRoutes, type RouteInfo } from '../../src/activity/route-inventory';
import type { TestApp } from './app';

export function appRoutes(t: TestApp): RouteInfo[] {
  return listRoutes(t.app.get(DiscoveryService), t.app.get(MetadataScanner), t.app.get(Reflector));
}
