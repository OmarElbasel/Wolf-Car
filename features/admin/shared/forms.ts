import { z } from "zod";
import { fieldErrors } from "@/lib/api/errors";
import { DISPLAY_NAME_MAX } from "@/shared/validation";

/** Messages are Validation.* keys (translated by <Field> / useFieldError). */
const EMAIL = z.email();
export const EMAIL_MAX = 254;

/** "" (no email) or a valid address. */
export const optionalEmail = z
  .string()
  .trim()
  .max(EMAIL_MAX, "tooLong")
  .refine((v) => v === "" || EMAIL.safeParse(v).success, "email");

/** Same limits as the API (2..DISPLAY_NAME_MAX after trimming). */
export const displayName = z.string().trim().min(1, "required").min(2, "tooShort").max(DISPLAY_NAME_MAX, "tooLong");

/**
 * Marks the fields named in a VALIDATION_FAILED response (dotted paths such as
 * "manager.displayName") as invalid. Returns false when none of them is a
 * field of this form, so the caller shows a toast instead.
 */
export function applyFieldErrors<T extends string>(error: unknown, fields: readonly T[], mark: (field: T) => void): boolean {
  const known = Object.keys(fieldErrors(error)).filter((f): f is T => (fields as readonly string[]).includes(f));
  known.forEach(mark);
  return known.length > 0;
}
