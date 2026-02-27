import { z } from "zod";
import { nonEmptyString } from "./common";

const targetYearSchema = z
  .number()
  .int("targetYear must be an integer")
  .min(2000, "targetYear must be between 2000 and 2100")
  .max(2100, "targetYear must be between 2000 and 2100");

export const previewTemplateSchema = z.object({
  sourceSnapshotId: nonEmptyString,
  targetYear: targetYearSchema
});

export const onboardTemplateSchema = z.object({
  sourceSnapshotId: nonEmptyString,
  name: nonEmptyString,
  targetYear: targetYearSchema,
  createdBy: nonEmptyString
});
