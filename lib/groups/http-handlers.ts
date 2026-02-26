import type { ArchiveGroupInput, CreateGroupInput, GroupType, UpdateGroupInput } from "./types";

type HandlerResult = {
  status: number;
  body: { data?: unknown; error?: string };
};

type GroupServiceLike = {
  list: (includeInactive?: boolean) => Promise<unknown>;
  getById: (groupId: string) => Promise<unknown>;
  create: (input: CreateGroupInput) => Promise<unknown>;
  update: (input: UpdateGroupInput) => Promise<unknown>;
  archive: (input: ArchiveGroupInput) => Promise<unknown>;
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

function getOptionalNumber(payload: Record<string, unknown>, field: string): number | undefined {
  const value = payload[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.trunc(value);
}

function parseGroupType(value: unknown): GroupType | null {
  if (value === "sector" || value === "non_operating" || value === "custom") {
    return value;
  }

  return null;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unexpected error";
}

function isNotFound(error: unknown): boolean {
  const message = asErrorMessage(error).toLowerCase();
  return message.includes("not found") || (message.includes("no") && message.includes("found"));
}

export async function listGroups(
  service: GroupServiceLike,
  includeInactive: boolean
): Promise<HandlerResult> {
  try {
    const data = await service.list(includeInactive);
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Failed to list groups" } };
  }
}

export async function getGroup(service: GroupServiceLike, groupId: string): Promise<HandlerResult> {
  if (!groupId || groupId.trim().length === 0) {
    return { status: 400, body: { error: "groupId is required" } };
  }

  try {
    const data = await service.getById(groupId);
    return { status: 200, body: { data } };
  } catch (error) {
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Group not found" } };
    }

    return { status: 500, body: { error: "Failed to fetch group" } };
  }
}

export async function createGroup(
  service: GroupServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const name = getRequiredString(payload, "name");
  const groupType = parseGroupType(payload.groupType);
  const sortOrder = getOptionalNumber(payload, "sortOrder");
  const createdBy = getOptionalString(payload, "createdBy");

  if (!name || !groupType) {
    return { status: 400, body: { error: "name and groupType are required" } };
  }

  try {
    const data = await service.create({
      name,
      groupType,
      sortOrder,
      createdBy
    });

    return { status: 201, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (message.includes("Invalid groupType")) {
      return { status: 400, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to create group" } };
  }
}

export async function updateGroup(
  service: GroupServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const groupId = getRequiredString(payload, "groupId");
  const name = getOptionalString(payload, "name") ?? undefined;
  const groupType = payload.groupType === undefined ? undefined : parseGroupType(payload.groupType);
  const sortOrder = getOptionalNumber(payload, "sortOrder");
  const updatedBy = getOptionalString(payload, "updatedBy");
  const reason = getOptionalString(payload, "reason") ?? undefined;

  if (!groupId) {
    return { status: 400, body: { error: "groupId is required" } };
  }

  if (groupType === null) {
    return { status: 400, body: { error: "Invalid groupType" } };
  }

  if (name === undefined && groupType === undefined && sortOrder === undefined) {
    return { status: 400, body: { error: "No updatable fields provided" } };
  }

  try {
    const data = await service.update({
      groupId,
      name,
      groupType,
      sortOrder,
      updatedBy,
      reason
    });

    return { status: 200, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Group not found" } };
    }

    if (message.includes("Invalid groupType")) {
      return { status: 400, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to update group" } };
  }
}

export async function archiveGroup(
  service: GroupServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const groupId = getRequiredString(payload, "groupId");
  const archivedBy = getOptionalString(payload, "archivedBy");
  const reason = getOptionalString(payload, "reason") ?? undefined;

  if (!groupId) {
    return { status: 400, body: { error: "groupId is required" } };
  }

  try {
    const data = await service.archive({
      groupId,
      archivedBy,
      reason
    });

    return { status: 200, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Group not found" } };
    }

    if (message.includes("already archived")) {
      return { status: 409, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to archive group" } };
  }
}
