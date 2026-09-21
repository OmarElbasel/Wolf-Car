import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { Client } from 'pg';
import { testEnv } from './test-env';

/**
 * Brings the test database schema up to date (non-destructive `migrate deploy`).
 * Each spec then clears the tables it needs through fixtures. As a guard
 * against pointing the suite at real data, the database name must contain
 * "test".
 *
 * The database's default time zone is set to Asia/Qatar so the suite proves
 * the app stores correct UTC instants on a server that is not in UTC.
 */
export default async function globalSetup(): Promise<void> {
  const overrides = testEnv();
  const env = { ...process.env, ...overrides };
  const dbName = new URL(overrides.DATABASE_URL).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to run e2e tests against "${dbName}": the test database name must contain "test".`);
  }
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  const db = new Client({ connectionString: overrides.DATABASE_URL });
  await db.connect();
  await db.query(`ALTER DATABASE "${dbName}" SET timezone TO 'Asia/Qatar'`);
  await db.end();
  rmSync('./storage/test-uploads', { recursive: true, force: true });
}
