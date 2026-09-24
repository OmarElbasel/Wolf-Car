import type { Config } from 'jest';
// Static import, not require(): Node 22.22+ strips types natively and loads this
// config as ESM, where `require` is not defined.
import swc from './test/swc-jest.cjs';

/** Unit tests: *.spec.ts next to the code, no database. */
const config: Config = {
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  ...swc,
  // the generated Prisma client imports "./x.js" siblings that exist only as .ts
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: './coverage',
};

export default config;
