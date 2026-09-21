import { Transform } from 'class-transformer';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { checkPasswordRules, PRICE_PATTERN } from '../../../shared/validation';

const RULE_TEXT: Record<string, string> = {
  length: 'be 12–128 characters long',
  upper: 'contain an uppercase letter',
  lower: 'contain a lowercase letter',
  number: 'contain a number',
  symbol: 'contain a symbol',
};

/**
 * Shared password policy (length, upper, lower, number, symbol). The
 * "not the username" rule needs the account, so services check it too.
 */
export function IsStrongPassword(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isStrongPassword',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && checkPasswordRules(value).every((r) => r.ok),
        defaultMessage: (args: ValidationArguments) => {
          const value = typeof args.value === 'string' ? args.value : '';
          const failed = checkPasswordRules(value)
            .filter((r) => !r.ok && RULE_TEXT[r.rule])
            .map((r) => RULE_TEXT[r.rule]);
          return `${args.property} must ${failed.join(', ') || 'meet the password policy'}`;
        },
      },
    });
}

/** Accepts 12.5, "12.5" or "12.50" and validates it as a QAR amount with ≤ 2 decimals. */
export function IsPrice(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isPrice',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && PRICE_PATTERN.test(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be an amount in QAR with at most 2 decimals (0 – 9,999,999.99)`,
      },
    });
}

export const ToPriceString = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : value,
  );

export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export const TrimLower = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Empty strings from multipart forms become undefined (i.e. "not provided"). */
export const EmptyToUndefined = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? undefined : t;
  });

/** Empty string becomes null (explicitly cleared). */
export const EmptyToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? null : t;
  });
