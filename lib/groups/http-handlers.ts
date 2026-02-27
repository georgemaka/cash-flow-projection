import type { ArchiveGroupInput, CreateGroupInput, GroupType, UpdateGroupInput } from "./types";
import {
  createGroupSchema,
  updateGroupSchema,
  archiveGroupSchema,
  firstZodError
} from "@/lib/validations";

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
  const result = createGroupSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  try {
    const data = await service.create(result.data as CreateGroupInput);
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
  const result = updateGroupSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { groupId, name, groupType, sortOrder, updatedBy, reason } = result.data;
  try {
    const data = await service.update({
      groupId,
      name,
      groupType: groupType as GroupType | undefined,
      sortOrder,
      updatedBy: updatedBy ?? null,
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
  const result = archiveGroupSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { groupId, archivedBy, reason } = result.data;
  try {
    const data = await service.archive({ groupId, archivedBy: archivedBy ?? null, reason });
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
