import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLE_KEY = 'throttle:auth';

/** Applies the strict per-IP "auth" rate limit (AUTH_THROTTLE_LIMIT per AUTH_THROTTLE_TTL_SECONDS). */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);
