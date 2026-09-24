import type { Config } from 'jest';
// Static import, not require(): Node 22.22+ strips types natively and loads this
// config as ESM, where `require` is not defined.
import swc from './swc-jest.cjs';

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
