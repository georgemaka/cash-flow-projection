import { z } from "zod";

/** Non-empty string that is automatically trimmed. */
export const nonEmptyString = z.string().trim().min(1);

/** YYYY-MM period string (year must be 2000–2100). */
export const yearMonthString = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be in YYYY-MM format")
  .refine((v) => {
    const year = parseInt(v.slice(0, 4), 10);
    return year >= 2000 && year <= 2100;
  }, "year must be between 2000 and 2100");

/** Return the first Zod issue message, optionally prefixed with the field path. */
export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const lastKey = issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : null;
  // Prepend the field name only when the message alone lacks context
  if (lastKey && !issue.message.startsWith(lastKey)) {
    return `${lastKey} ${issue.message}`;
  }
  return issue.message;
}
