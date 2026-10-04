import { z } from "zod";
import {
  BOOKING_NAME_MAX,
  BOOKING_NAME_MIN,
  DAY_PATTERN,
  normaliseDigits,
  PHONE_PATTERN,
  SALES_PIN_PATTERN,
  TIME_PATTERN,
} from "@/shared/validation";

/** Messages are Validation.* keys (translated by <Field> / useFieldError). The API applies the same rules. */
const clean = (v: string) => v.trim().replace(/\s+/g, " ");

export const nameField = z.string().transform(clean).pipe(z.string().min(1, "required").min(BOOKING_NAME_MIN, "tooShort").max(BOOKING_NAME_MAX, "tooLong"));
/** "" (none) or a name. */
export const optionalName = z
  .string()
  .transform(clean)
  .pipe(z.string().max(BOOKING_NAME_MAX, "tooLong").refine((v) => v === "" || v.length >= BOOKING_NAME_MIN, "tooShort"));
export const optionalPhone = z
  .string()
  .transform((v) => clean(normaliseDigits(v)))
  .pipe(z.string().refine((v) => v === "" || PHONE_PATTERN.test(v), "phone"));
export const optionalText = (max: number) => z.string().trim().max(max, "tooLong");
export const requiredText = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");
export const dayField = z.string().min(1, "required").regex(DAY_PATTERN, "invalid");
export const optionalDay = z.string().refine((v) => v === "" || DAY_PATTERN.test(v), "invalid");
export const optionalTime = z.string().refine((v) => v === "" || TIME_PATTERN.test(v), "invalid");
export const pinField = z
  .string()
  .transform((v) => normaliseDigits(v).trim())
  .pipe(z.string().regex(SALES_PIN_PATTERN, "pin"));
