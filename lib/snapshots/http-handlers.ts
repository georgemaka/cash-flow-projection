import type {
  CopySnapshotInput,
  CreateSnapshotInput,
  LockSnapshotInput,
  UnlockSnapshotInput
} from "./types";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequiredString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOptionalString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidAsOfMonth(asOfMonth: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(asOfMonth);
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unexpected error";
}

function isNotFound(error: unknown): boolean {
  const message = asErrorMessage(error).toLowerCase();
  return message.includes("not found") || (message.includes("no") && message.includes("found"));
}

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
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Snapshot not found" } };
    }
    return { status: 500, body: { error: "Failed to fetch snapshot" } };
  }
}

export async function createSnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const name = getRequiredString(payload, "name");
  const asOfMonth = getRequiredString(payload, "asOfMonth");
  const createdBy = getRequiredString(payload, "createdBy");

  if (!name || !asOfMonth || !createdBy) {
    return { status: 400, body: { error: "name, asOfMonth, and createdBy are required" } };
  }

  if (!isValidAsOfMonth(asOfMonth)) {
    return { status: 400, body: { error: "asOfMonth must be in YYYY-MM format" } };
  }

  try {
    const data = await service.create({ name, asOfMonth, createdBy });
    return { status: 201, body: { data } };
  } catch {
    return { status: 500, body: { error: "Failed to create snapshot" } };
  }
}

export async function lockSnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const snapshotId = getRequiredString(payload, "snapshotId");
  const lockedBy = getRequiredString(payload, "lockedBy");
  const reason = getOptionalString(payload, "reason");

  if (!snapshotId || !lockedBy) {
    return { status: 400, body: { error: "snapshotId and lockedBy are required" } };
  }

  try {
    const data = await service.lock({ snapshotId, lockedBy, reason: reason ?? undefined });
    return { status: 200, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (message.includes("already locked")) {
      return { status: 409, body: { error: message } };
    }
    return { status: 500, body: { error: "Failed to lock snapshot" } };
  }
}

export async function unlockSnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const snapshotId = getRequiredString(payload, "snapshotId");
  const unlockedBy = getRequiredString(payload, "unlockedBy");
  const reason = getOptionalString(payload, "reason");

  if (!snapshotId || !unlockedBy) {
    return { status: 400, body: { error: "snapshotId and unlockedBy are required" } };
  }

  try {
    const data = await service.unlock({ snapshotId, unlockedBy, reason: reason ?? undefined });
    return { status: 200, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (message.includes("already unlocked")) {
      return { status: 409, body: { error: message } };
    }
    return { status: 500, body: { error: "Failed to unlock snapshot" } };
  }
}

export async function copySnapshot(
  service: SnapshotServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const sourceSnapshotId = getRequiredString(payload, "sourceSnapshotId");
  const name = getRequiredString(payload, "name");
  const asOfMonth = getRequiredString(payload, "asOfMonth");
  const createdBy = getRequiredString(payload, "createdBy");

  if (!sourceSnapshotId || !name || !asOfMonth || !createdBy) {
    return {
      status: 400,
      body: { error: "sourceSnapshotId, name, asOfMonth, and createdBy are required" }
    };
  }

  if (!isValidAsOfMonth(asOfMonth)) {
    return { status: 400, body: { error: "asOfMonth must be in YYYY-MM format" } };
  }

  try {
    const data = await service.copyFromPrior({
      sourceSnapshotId,
      name,
      asOfMonth,
      createdBy
    });
    return { status: 201, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (message.includes("Can only copy from a locked snapshot")) {
      return { status: 409, body: { error: message } };
    }
    return { status: 500, body: { error: "Failed to copy snapshot" } };
  }
}
