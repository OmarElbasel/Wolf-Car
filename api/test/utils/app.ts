import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { validateEnv } from '../../src/config/env';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule with the same global setup as main.ts. `env`
 * overrides (validated and typed like real env vars) are applied before the
 * app starts, e.g. a low AUTH_THROTTLE_LIMIT for the rate-limit spec.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  if (Object.keys(env).length) {
    // the config module validated process.env at import time; apply typed overrides now
    const config = moduleRef.get(ConfigService);
    const validated = validateEnv({ ...process.env, ...env }) as unknown as Record<string, unknown>;
    for (const key of Object.keys(env)) config.set(key, validated[key]);
  }
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  configureApp(app);
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}
