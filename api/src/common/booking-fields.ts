import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength, NotContains, ValidateIf } from 'class-validator';
import { BOOKING_NAME_MAX, BOOKING_NAME_MIN, normaliseDigits, PHONE_PATTERN } from '../../../shared/validation';

type Decorate = (target: object, key: string) => void;

/** PostgreSQL text cannot hold a NUL character; it is never something a person typed. */
const clean = (text: string) => text.replaceAll('\u0000', '');

const collapse = ({ value }: { value: unknown }) => (typeof value === 'string' ? clean(value).trim().replace(/\s+/g, ' ') : value);
const phone = ({ value }: { value: unknown }) => (typeof value === 'string' ? normaliseDigits(clean(value)).trim().replace(/\s+/g, ' ') : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? clean(value).trim() : value);

/** Car, owner name, salesperson name: free text in any script, 2–80 characters. */
export const NameField = (): Decorate => (target, key) => {
  Transform(collapse)(target, key);
  IsString()(target, key);
  MinLength(BOOKING_NAME_MIN)(target, key);
  MaxLength(BOOKING_NAME_MAX)(target, key);
};

/** Digits typed on an Arabic keyboard are stored as 0-9. */
export const PhoneField = (): Decorate => (target, key) => {
  Transform(phone)(target, key);
  IsString()(target, key);
  Matches(PHONE_PATTERN, { message: `${key} may contain an optional +, digits and spaces (6–20 characters)` })(target, key);
};

/** Free text with a length limit (service, note, reason). */
export const TextField = (max: number): Decorate => (target, key) => {
  Transform(trim)(target, key);
  IsString()(target, key);
  MinLength(1)(target, key);
  MaxLength(max)(target, key);
};

/** Search text: short, and refused outright when it holds a character the database cannot store. */
export const SearchField = (): Decorate => (target, key) => {
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))(target, key);
  IsString()(target, key);
  MaxLength(80)(target, key);
  NotContains('\u0000', { message: `${key} contains a character that cannot be searched` })(target, key);
};

/**
 * For update DTOs: the field may be left out, but when it is sent it must be
 * valid — unlike @IsOptional(), null does not slip through to the database.
 */
export const IfSent = (): Decorate => (target, key) => {
  ValidateIf((_o: object, value: unknown) => value !== undefined)(target, key);
};
