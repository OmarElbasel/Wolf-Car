import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The pg driver adapter writes DateTime values without a UTC offset and reads
 * timestamptz values back as if they were UTC, so it is only correct when the
 * session time zone is UTC. Pin it per connection: a Postgres whose default
 * zone is local time (e.g. Asia/Qatar) would otherwise store every timestamp
 * shifted by the zone offset.
 */
export function createPgAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString, options: '-c TimeZone=UTC' });
}
