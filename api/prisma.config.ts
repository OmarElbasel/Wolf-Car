import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env on its own; Node can.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file (CI / Docker): rely on the real environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
