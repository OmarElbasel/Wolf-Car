import type { Config } from 'jest';

/** Types for swc-jest.cjs, so the jest configs that import it typecheck. */
declare const swc: Pick<Config, 'transform' | 'transformIgnorePatterns'>;
export = swc;
