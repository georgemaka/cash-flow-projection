import { z } from "zod";
import { nonEmptyString, yearMonthString } from "./common";

export const bulkFieldSchema = z.enum(["projected", "actual"]);
export const bulkOperationSchema = z.enum(["multiply", "add"]);

export const bulkUpdateSchema = z
  .object({
    snapshotId: nonEmptyString,
    groupId: z.string().trim().min(1).optional(),
    field: bulkFieldSchema,
    operation: bulkOperationSchema,
    operand: z.number().finite("operand must be a finite number"),
    preview: z.boolean().optional(),
    reason: z.string().trim().min(1).optional(),
    updatedBy: z.string().trim().optional()
  })
  .refine((d) => d.preview === true || !!d.reason, {
    message: "reason is required when not in preview mode",
    path: ["reason"]
  });

const restoreEntrySchema = z.object({
  lineItemId: nonEmptyString,
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
    .optional()
});

export const bulkRestoreSchema = z.object({
  snapshotId: nonEmptyString,
  reason: nonEmptyString,
  updatedBy: z.string().trim().optional(),
  restores: z.array(restoreEntrySchema).min(1, "restores array must not be empty")
});
