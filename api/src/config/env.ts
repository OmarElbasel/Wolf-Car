import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()) : value;
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Every environment variable the API reads, validated once at startup. */
export class Env {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL = 'info';

  /** Comma-separated allowlist of browser origins. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string;

  @IsString()
  TRUST_PROXY = 'loopback';

  @Transform(toBool)
  @IsBoolean()
  SWAGGER_ENABLED = false;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, { message: 'DATABASE_URL must be a postgres:// URL' })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TTL_DAYS = 7;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  SHOWROOM_SESSION_TTL_HOURS = 16;

  @Transform(toBool)
  @IsBoolean()
  COOKIE_SECURE = true;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  LOGIN_MAX_ATTEMPTS = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  LOGIN_LOCK_MINUTES = 15;

  /** General per-IP request budget per minute (all routes). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_PER_MINUTE = 300;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT = 10;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_TTL_SECONDS = 60;

  /** 32 random bytes, base64 — AES-256-GCM key for TOTP secrets at rest. */
  @IsString()
  @Matches(/^[A-Za-z0-9+/]{43}=$/, { message: 'TOTP_ENCRYPTION_KEY must be 32 bytes, base64-encoded' })
  TOTP_ENCRYPTION_KEY: string;

  @IsString()
  @IsNotEmpty()
  TOTP_ISSUER = 'Wolf Car';

  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR = './storage/uploads';

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  CHROME_PATH?: string;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { exposeDefaultValues: true });
  const errors = validateSync(env, { whitelist: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return env;
}

export function corsOrigins(env: Pick<Env, 'CORS_ORIGINS'>): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
