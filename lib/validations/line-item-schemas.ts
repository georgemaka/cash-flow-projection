import { z } from "zod";
import { nonEmptyString } from "./common";

export const projectionMethodSchema = z.enum([
  "manual",
  "annual_spread",
  "prior_year_pct",
  "prior_year_flat",
  "custom_formula"
]);

/** Per-method projection params schemas */
const annualSpreadParamsSchema = z.object({
  annualTotal: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "annualTotal must be a decimal string")
});

const priorYearPctParamsSchema = z.object({
  pctChange: z.number().min(-100).max(1000)
});

const emptyParamsSchema = z.object({}).passthrough();

/**
 * Validates projectionParams based on the projectionMethod.
 * Falls back to a permissive record if method is not provided (create defaults to manual).
 */
export function validateProjectionParams(method: string | undefined, params: unknown): boolean {
  if (params === null || params === undefined) return true;
  switch (method) {
    case "annual_spread":
      return annualSpreadParamsSchema.safeParse(params).success;
    case "prior_year_pct":
      return priorYearPctParamsSchema.safeParse(params).success;
    case "manual":
    case "prior_year_flat":
    case "custom_formula":
      return emptyParamsSchema.safeParse(params).success;
    default:
      return z.record(z.string(), z.unknown()).safeParse(params).success;
  }
}

export const projectionParamsSchema = z.record(z.string(), z.unknown()).nullable().optional();

export const createLineItemSchema = z
  .object({
    groupId: nonEmptyString,
    label: nonEmptyString,
    projectionMethod: projectionMethodSchema.optional(),
    projectionParams: projectionParamsSchema,
    sortOrder: z.number().int().min(0).optional(),
    createdBy: z.string().trim().optional()
  })
  .refine((d) => validateProjectionParams(d.projectionMethod, d.projectionParams), {
    message: "projectionParams invalid for the selected projectionMethod"
  });

export const updateLineItemSchema = z
  .object({
    lineItemId: nonEmptyString,
    groupId: nonEmptyString.optional(),
    label: nonEmptyString.optional(),
    projectionMethod: projectionMethodSchema.optional(),
    projectionParams: projectionParamsSchema,
    sortOrder: z.number().int().min(0).optional(),
    updatedBy: z.string().trim().optional(),
    reason: z.string().trim().max(1000).optional()
  })
  .refine(
    (d) =>
      d.groupId !== undefined ||
      d.label !== undefined ||
      d.projectionMethod !== undefined ||
      d.projectionParams !== undefined ||
      d.sortOrder !== undefined,
    { message: "No updatable fields provided" }
  )
  .refine((d) => validateProjectionParams(d.projectionMethod, d.projectionParams), {
    message: "projectionParams invalid for the selected projectionMethod"
  });

export const archiveLineItemSchema = z.object({
  lineItemId: nonEmptyString,
  archivedBy: z.string().trim().optional(),
  reason: z.string().trim().max(1000).optional()
});
