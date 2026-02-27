import { z } from "zod";
import { nonEmptyString } from "./common";

export const groupTypeSchema = z.enum(["sector", "non_operating", "custom"]);

export const createGroupSchema = z.object({
  name: nonEmptyString.max(100),
  groupType: groupTypeSchema,
  sortOrder: z.number().int().min(0).optional(),
  createdBy: z.string().trim().optional()
});

export const updateGroupSchema = z
  .object({
    groupId: nonEmptyString,
    name: nonEmptyString.max(100).optional(),
    groupType: groupTypeSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
    updatedBy: z.string().trim().optional(),
    reason: z.string().trim().max(1000).optional()
  })
  .refine((d) => d.name !== undefined || d.groupType !== undefined || d.sortOrder !== undefined, {
    message: "No updatable fields provided"
  });

export const archiveGroupSchema = z.object({
  groupId: nonEmptyString,
  archivedBy: z.string().trim().optional(),
  reason: z.string().trim().max(1000).optional()
});
