import { z } from "zod";

/**
 * Validate required environment variables at module load time.
 *
 * Importing this module will throw immediately if any required variable
 * is missing or malformed, preventing cryptic runtime errors later.
 */

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required")
});

function validateEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.message).join(", ");
    throw new Error(`Environment validation failed: ${missing}`);
  }
  return result.data;
}

export const env = validateEnv();
