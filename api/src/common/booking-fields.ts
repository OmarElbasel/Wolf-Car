import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { BOOKING_NAME_MAX, BOOKING_NAME_MIN, normaliseDigits, PHONE_PATTERN } from '../../../shared/validation';

type Decorate = (target: object, key: string) => void;

const collapse = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const phone = ({ value }: { value: unknown }) => (typeof value === 'string' ? normaliseDigits(value).trim().replace(/\s+/g, ' ') : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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
