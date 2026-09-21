import type { Config } from 'jest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const swc = require('./test/swc-jest.cjs');

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
