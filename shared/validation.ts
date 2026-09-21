/**
 * Validation rules shared by the API (class-validator) and the web app (zod),
 * so both sides accept and reject exactly the same input. Keep this file free
 * of imports: it is compiled into both projects.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = 'length' | 'upper' | 'lower' | 'number' | 'symbol' | 'notUsername';

export interface PasswordRuleResult {
  rule: PasswordRule;
  ok: boolean;
}

// Built with the constructor so projects targeting < ES2018 still type-check.
const UPPER = new RegExp('\\p{Lu}', 'u');
const LOWER = new RegExp('\\p{Ll}', 'u');
const DIGIT = new RegExp('\\p{Nd}', 'u');
const SYMBOL = new RegExp('[^\\p{L}\\p{Nd}\\s]', 'u');

/** Evaluates every password rule; used for the live checklist and for validation. */
export function checkPasswordRules(password: string, username = ''): PasswordRuleResult[] {
  const lowered = password.toLowerCase();
  const user = username.trim().toLowerCase();
  return [
    { rule: 'length', ok: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
    { rule: 'upper', ok: UPPER.test(password) },
    { rule: 'lower', ok: LOWER.test(password) },
    { rule: 'number', ok: DIGIT.test(password) },
    { rule: 'symbol', ok: SYMBOL.test(password) },
    // "not matching username": neither equal to it nor containing it
    { rule: 'notUsername', ok: user.length === 0 || (lowered !== user && !lowered.includes(user)) },
  ];
}

export function isStrongPassword(password: string, username = ''): boolean {
  return checkPasswordRules(password, username).every((r) => r.ok);
}

/** Auto-generated usernames: lowercase, starts with a letter or digit. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export const DISPLAY_NAME_MAX = 120;
export const BRANCH_CODE_PATTERN = /^[A-Z]{2,4}$/;
export const BRANCH_NAME_MAX = 120;

export const PRODUCT_NAME_MAX = 120;
export const PRODUCT_DESCRIPTION_MAX = 2000;
/** Optional free-form barcode (EAN/UPC/internal codes): letters, digits, dashes. */
export const BARCODE_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/** QAR with up to 2 decimals, max 9,999,999.99. */
export const PRICE_PATTERN = /^(0|[1-9]\d{0,6})(\.\d{1,2})?$/;
export const CURRENCY = 'QAR';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const CUSTOMER_NAME_MIN = 2;
/** Letters of any script, combining marks, spaces and . ' - (must start with a letter). */
export const CUSTOMER_NAME_PATTERN = new RegExp("^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]*$", 'u');
export const CUSTOMER_NAME_MAX = 80;
export const ORDER_MAX_LINES = 50;
export const ORDER_MAX_QUANTITY = 99;
export const ORDER_CODE_PATTERN = /^[A-Z]{2,4}-\d{6}$/;

export const TOTP_CODE_PATTERN = /^\d{6}$/;
/** Recovery codes are shown as xxxxx-xxxxx (base32, lowercase). */
export const RECOVERY_CODE_PATTERN = /^[a-z2-7]{5}-[a-z2-7]{5}$/;
