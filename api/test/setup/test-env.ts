/** Environment for the e2e suite. The test database is wiped on every run. */
export function testEnv(): Record<string, string> {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* CI provides the variables */
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set for e2e tests');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  return {
    NODE_ENV: 'test',
    DATABASE_URL: url,
    LOG_LEVEL: 'silent',
    SWAGGER_ENABLED: 'false',
    CORS_ORIGINS: 'http://localhost:3000',
    TRUST_PROXY: 'loopback',
    RATE_LIMIT_PER_MINUTE: '100000',
    AUTH_THROTTLE_LIMIT: '100000',
    AUTH_THROTTLE_TTL_SECONDS: '60',
    UPLOAD_DIR: './storage/test-uploads',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-secret-test-secret-test-secret-1234',
    TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY ?? 'x+2Xewyg9jKZ9SYe3LaZo/6ETQkH2lyjFhSkDhfxoBo=',
  };
}
