import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { testEnv } from './test-env';

/**
 * Brings the test database schema up to date (non-destructive `migrate deploy`).
 * Each spec then clears the tables it needs through fixtures. As a guard
 * against pointing the suite at real data, the database name must contain
 * "test".
 */
export default function globalSetup(): void {
  const overrides = testEnv();
  const env = { ...process.env, ...overrides };
  const dbName = new URL(overrides.DATABASE_URL).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to run e2e tests against "${dbName}": the test database name must contain "test".`);
  }
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  rmSync('./storage/test-uploads', { recursive: true, force: true });
}
