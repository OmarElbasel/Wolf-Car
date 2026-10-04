import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { DAY_PATTERN } from '../../../shared/validation';

const DAY_MS = 86_400_000;
/** Qatar is UTC+3 all year (no daylight saving). */
const QATAR_OFFSET_MS = 3 * 3_600_000;

/**
 * Calendar days travel as "YYYY-MM-DD" strings and live in DATE columns, which
 * Prisma reads and writes as a Date at UTC midnight. They are never converted
 * through a local time zone.
 */
export const toDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
export const dayStr = (date: Date): string => date.toISOString().slice(0, 10);

/** A well-formed day that also exists (so not 2026-02-30). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const date = toDate(value);
  return !Number.isNaN(date.getTime()) && dayStr(date) === value;
}

export const qatarToday = (now: Date = new Date()): string => dayStr(new Date(now.getTime() + QATAR_OFFSET_MS));
export const addDays = (day: string, n: number): string => dayStr(new Date(toDate(day).getTime() + n * DAY_MS));
/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number => Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);

/** Every day from `from` to `to`, both included. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function IsDay(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isDay',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isDay(value),
        defaultMessage: (args: ValidationArguments) => `${args.property} must be a real date in the form YYYY-MM-DD`,
      },
    });
}

/** ":date" route segment → validated day string. */
@Injectable()
export class ParseDayPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isDay(value)) throw new BadRequestException('date must be a real date in the form YYYY-MM-DD');
    return value;
  }
}
