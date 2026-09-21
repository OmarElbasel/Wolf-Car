import { corsOrigins, validateEnv } from './env';

const base = {
  CORS_ORIGINS: 'http://localhost:3000, https://wolfcar.qa',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('validateEnv', () => {
  it('applies defaults and coerces types', () => {
    const env = validateEnv({ ...base, PORT: '4100', COOKIE_SECURE: 'false', CHROME_PATH: '' });
    expect(env.PORT).toBe(4100);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.LOGIN_MAX_ATTEMPTS).toBe(5);
    expect(env.CHROME_PATH).toBeUndefined();
  });

  it.each([
    ['short JWT secret', { JWT_ACCESS_SECRET: 'short' }, 'JWT_ACCESS_SECRET'],
    ['bad TOTP key', { TOTP_ENCRYPTION_KEY: 'abc' }, 'TOTP_ENCRYPTION_KEY'],
    ['non-postgres url', { DATABASE_URL: 'mysql://x' }, 'DATABASE_URL'],
    ['token TTL too long', { JWT_ACCESS_TTL_SECONDS: '86400' }, 'JWT_ACCESS_TTL_SECONDS'],
  ])('rejects %s', (_label, patch, field) => {
    expect(() => validateEnv({ ...base, ...patch })).toThrow(field);
  });

  it('requires the CORS allowlist', () => {
    const { CORS_ORIGINS: _omit, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow('CORS_ORIGINS');
  });

  it('splits the CORS allowlist', () => {
    expect(corsOrigins({ CORS_ORIGINS: base.CORS_ORIGINS })).toEqual(['http://localhost:3000', 'https://wolfcar.qa']);
  });
});
