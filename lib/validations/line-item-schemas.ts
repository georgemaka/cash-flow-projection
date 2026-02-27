import { z } from "zod";
import { nonEmptyString } from "./common";

export const projectionMethodSchema = z.enum([
  "manual",
  "annual_spread",
  "prior_year_pct",
  "prior_year_flat",
  "custom_formula"
]);

export const createLineItemSchema = z.object({
  groupId: nonEmptyString,
  label: nonEmptyString,
  projectionMethod: projectionMethodSchema.optional(),
  projectionParams: z.record(z.string(), z.unknown()).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  createdBy: z.string().trim().optional()
});

export const updateLineItemSchema = z
  .object({
    lineItemId: nonEmptyString,
    groupId: nonEmptyString.optional(),
    label: nonEmptyString.optional(),
    projectionMethod: projectionMethodSchema.optional(),
    projectionParams: z.record(z.string(), z.unknown()).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    updatedBy: z.string().trim().optional(),
    reason: z.string().trim().optional()
  })
  .refine(
    (d) =>
      d.groupId !== undefined ||
      d.label !== undefined ||
      d.projectionMethod !== undefined ||
      d.projectionParams !== undefined ||
      d.sortOrder !== undefined,
    { message: "No updatable fields provided" }
  );

export const archiveLineItemSchema = z.object({
  lineItemId: nonEmptyString,
  archivedBy: z.string().trim().optional(),
  reason: z.string().trim().optional()
});
