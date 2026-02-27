import { z } from "zod";

/** Non-empty string that is automatically trimmed. */
export const nonEmptyString = z.string().trim().min(1);

/** YYYY-MM period string. */
export const yearMonthString = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be in YYYY-MM format");

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
