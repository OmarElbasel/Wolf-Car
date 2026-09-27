/**
 * Rotates every user's credentials after a database is moved to production.
 * Destructive for logins: everyone is signed out and must use the printed
 * passwords. Refuses to run without --confirm.
 *
 *   docker compose -f compose.prod.yml --env-file deploy/prod.env \
 *     exec api node dist/api/src/scripts/rotate-credentials.cli.js --confirm
 */
import 'reflect-metadata';
import { PrismaClient } from '../generated/prisma/client';
import { createPgAdapter } from '../prisma/pg-adapter';
import { PasswordService } from '../auth/password.service';
import { rotateCredentials } from './rotate-credentials';

async function main(): Promise<void> {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm: this replaces every password and signs everyone out.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
  try {
    const rows = await rotateCredentials(prisma, new PasswordService());
    console.log('\nNew credentials — shown once. Copy them now.\n');
    console.table(
      rows.map((r) => ({
        username: r.username,
        name: r.displayName,
        role: r.role,
        'dashboard password': r.password,
        'showroom password': r.showroomPassword ?? '—',
      })),
    );
    console.log(`${rows.length} user(s) rotated; all sessions revoked; two-factor reset.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
