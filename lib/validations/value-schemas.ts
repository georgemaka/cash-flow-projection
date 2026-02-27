import { z } from "zod";
import { nonEmptyString, yearMonthString } from "./common";

export const upsertValueSchema = z.object({
  lineItemId: nonEmptyString,
  snapshotId: nonEmptyString,
  period: yearMonthString,
  projectedAmount: z.string().nullable().optional(),
  actualAmount: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  updatedBy: z.string().optional(),
  reason: z.string().trim().optional()
});
