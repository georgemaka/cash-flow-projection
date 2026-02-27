import type {
  CopySnapshotInput,
  CreateSnapshotInput,
  LockSnapshotInput,
  UnlockSnapshotInput
} from "./types";
import type { SnapshotCompareResult } from "./compare-service";
import {
  createSnapshotSchema,
  lockSnapshotSchema,
  unlockSnapshotSchema,
  copySnapshotSchema,
  compareSnapshotParamsSchema,
  firstZodError
} from "@/lib/validations";
import {
  AlreadyLockedError,
  AlreadyUnlockedError,
  NotFoundError,
  SourceNotLockedError
} from "@/lib/errors";

type HandlerResult = {
  status: number;
  body: { data?: unknown; error?: string };
};

type SnapshotServiceLike = {
  list: () => Promise<unknown>;
  getById: (snapshotId: string) => Promise<unknown>;
  create: (input: CreateSnapshotInput) => Promise<unknown>;
  lock: (input: LockSnapshotInput) => Promise<unknown>;
  unlock: (input: UnlockSnapshotInput) => Promise<unknown>;
  copyFromPrior: (input: CopySnapshotInput) => Promise<unknown>;
};

type CompareServiceLike = {
  compare: (snapshotAId: string, snapshotBId: string) => Promise<SnapshotCompareResult>;
};

export async function listSnapshots(service: SnapshotServiceLike): Promise<HandlerResult> {
  try {
    const data = await service.list();
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Failed to list snapshots" } };
  }
}

export async function getSnapshot(
  service: SnapshotServiceLike,
  snapshotId: string
): Promise<HandlerResult> {
  if (!snapshotId || snapshotId.trim().length === 0) {
    return { status: 400, body: { error: "snapshotId is required" } };
  }

  try {
    const data = await service.getById(snapshotId);
    return { status: 200, body: { data } };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { status: 404, body: { error: "Snapshot not found" } };
    }
    return { status: 500, body: { error: "Failed to fetch snapshot" } };
  }
}

export async function createSnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  const result = createSnapshotSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  try {
    const data = await service.create(result.data);
    return { status: 201, body: { data } };
  } catch {
    return { status: 500, body: { error: "Failed to create snapshot" } };
  }
}

export async function lockSnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  const result = lockSnapshotSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { snapshotId, lockedBy, reason } = result.data;
  try {
    const data = await service.lock({ snapshotId, lockedBy, reason });
    return { status: 200, body: { data } };
  } catch (error) {
    if (error instanceof AlreadyLockedError) {
      return { status: 409, body: { error: error.message } };
    }
    return { status: 500, body: { error: "Failed to lock snapshot" } };
  }
}

export async function unlockSnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  const result = unlockSnapshotSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { snapshotId, unlockedBy, reason } = result.data;
  try {
    const data = await service.unlock({ snapshotId, unlockedBy, reason });
    return { status: 200, body: { data } };
  } catch (error) {
    if (error instanceof AlreadyUnlockedError) {
      return { status: 409, body: { error: error.message } };
    }
    return { status: 500, body: { error: "Failed to unlock snapshot" } };
  }
}

export async function copySnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  const result = copySnapshotSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  try {
    const data = await service.copyFromPrior(result.data);
    return { status: 201, body: { data } };
  } catch (error) {
    if (error instanceof SourceNotLockedError) {
      return { status: 409, body: { error: error.message } };
    }
    return { status: 500, body: { error: "Failed to copy snapshot" } };
  }
}

export async function compareSnapshots(
  service: CompareServiceLike,
  snapshotAId: string | null,
  snapshotBId: string | null
): Promise<HandlerResult> {
  const result = compareSnapshotParamsSchema.safeParse({
    a: snapshotAId ?? "",
    b: snapshotBId ?? ""
  });
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  try {
    const data = await service.compare(result.data.a, result.data.b);
    return { status: 200, body: { data } };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { status: 404, body: { error: "One or both snapshots not found" } };
    }
    return { status: 500, body: { error: "Failed to compare snapshots" } };
  }
}
