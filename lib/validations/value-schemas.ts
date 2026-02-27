import { z } from "zod";
import { nonEmptyString, yearMonthString } from "./common";

export const upsertValueSchema = z.object({
  lineItemId: nonEmptyString,
  snapshotId: nonEmptyString,
  period: yearMonthString,
  projectedAmount: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "must be a valid decimal amount")
    .nullable()
    .optional(),
  actualAmount: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "must be a valid decimal amount")
    .nullable()
    .optional(),
  note: z.string().nullable().optional(),
  updatedBy: z.string().optional(),
  reason: z.string().trim().optional()
});
