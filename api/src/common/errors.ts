import { HttpException, HttpStatus } from '@nestjs/common';

/** 423 — account temporarily locked after repeated failures. */
export class AccountLockedException extends HttpException {
  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.LOCKED,
        error: 'Locked',
        code: 'ACCOUNT_LOCKED',
        message: 'Too many failed attempts. Try again later.',
        retryAfterSeconds,
      },
      HttpStatus.LOCKED,
    );
  }
}

/** 401 with a stable machine-readable code the web app can switch on. */
export class AuthFailedException extends HttpException {
  constructor(code: 'INVALID_CREDENTIALS' | 'INVALID_2FA' | 'SESSION_EXPIRED' = 'INVALID_CREDENTIALS') {
    const message =
      code === 'INVALID_2FA'
        ? 'Invalid verification code.'
        : code === 'SESSION_EXPIRED'
          ? 'Your session has expired. Please sign in again.'
          : 'Invalid username or password.';
    super({ statusCode: HttpStatus.UNAUTHORIZED, error: 'Unauthorized', code, message }, HttpStatus.UNAUTHORIZED);
  }
}

/** 409 — the order is no longer pending, so it cannot be changed. */
export class OrderLockedException extends HttpException {
  constructor(status: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'ORDER_NOT_PENDING',
        message: `Order is ${status.toLowerCase()} and can no longer be changed.`,
      },
      HttpStatus.CONFLICT,
    );
  }
}
