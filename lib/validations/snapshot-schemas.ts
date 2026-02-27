import { z } from "zod";
import { nonEmptyString, yearMonthString } from "./common";

export const createSnapshotSchema = z.object({
  name: nonEmptyString,
  asOfMonth: yearMonthString,
  createdBy: nonEmptyString
});

export const lockSnapshotSchema = z.object({
  snapshotId: nonEmptyString,
  lockedBy: nonEmptyString,
  reason: z.string().trim().max(1000).optional()
});

export const unlockSnapshotSchema = z.object({
  snapshotId: nonEmptyString,
  unlockedBy: nonEmptyString,
  reason: z.string().trim().max(1000).optional()
});

export const copySnapshotSchema = z.object({
  sourceSnapshotId: nonEmptyString,
  name: nonEmptyString,
  asOfMonth: yearMonthString,
  createdBy: nonEmptyString
});

export const compareSnapshotParamsSchema = z
  .object({
    a: z.string().trim().min(1, "snapshotAId (query param 'a') is required"),
    b: z.string().trim().min(1, "snapshotBId (query param 'b') is required")
  })
  .refine((d) => d.a !== d.b, { message: "Snapshots must be different" });
