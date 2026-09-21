import { Prisma } from '../generated/prisma/client';

/** Decimal → "1234.50" (API money format: string, 2 decimals, no float rounding). */
export function money(value: Prisma.Decimal): string;
export function money(value: Prisma.Decimal | null): string | null;
export function money(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

export const decimal = (value: string | number) => new Prisma.Decimal(value);
