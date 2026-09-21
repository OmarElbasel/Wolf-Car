// Shared Jest transform: SWC compiles our TypeScript (with decorator metadata
// for Nest DI) and the ESM-only dependencies (NestJS 12, file-type) to CommonJS,
// so the suites run on Node 22 (Jest only loads ESM natively from Node 24.9).
module.exports = {
  transform: {
    '^.+\\.(t|j|mj)s$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          keepClassNames: true,
        },
        module: { type: 'commonjs' },
        sourceMaps: 'inline',
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@nestjs|file-type|strtok3|token-types|@tokenizer/inflate|uint8array-extras|@borewit|@scure|@noble|@otplib|otplib)/)',
  ],
};
