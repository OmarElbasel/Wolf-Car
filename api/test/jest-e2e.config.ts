import type { Config } from 'jest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const swc = require('./swc-jest.cjs');

/** End-to-end tests against a real Postgres (TEST_DATABASE_URL), run in band. */
const config: Config = {
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts'],
  rootDir: '..',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  ...swc,
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['reflect-metadata', '<rootDir>/test/setup/env.ts'],
  testTimeout: 30_000,
};

export default config;
