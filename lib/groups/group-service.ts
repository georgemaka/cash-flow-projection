import { type PrismaClient, Prisma } from "@prisma/client";
import { diffFields, type AuditService } from "../audit";
import type { ArchiveGroupInput, CreateGroupInput, GroupType, UpdateGroupInput } from "./types";
import { AlreadyArchivedError, NotFoundError } from "@/lib/errors";

const TRACKED_GROUP_FIELDS = ["name", "groupType", "sortOrder", "isActive", "archivedAt"];

function isGroupType(value: unknown): value is GroupType {
  return value === "sector" || value === "non_operating" || value === "custom";
}

export class GroupService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService
  ) {}

  async list(includeInactive = false) {
    return this.prisma.group.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async getById(groupId: string) {
    try {
      return await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundError(`Group not found: ${groupId}`);
      }
      throw e;
    }
  }

  async create(input: CreateGroupInput) {
    if (!isGroupType(input.groupType)) {
      throw new Error("Invalid groupType");
    }

    const created = await this.prisma.group.create({
      data: {
        name: input.name,
        groupType: input.groupType,
        sortOrder: input.sortOrder ?? 0,
        createdBy: input.createdBy
      }
    });

    await this.audit.logCreate({
      userId: input.createdBy,
      tableName: "Group",
      recordId: created.id,
      fields: {
        name: created.name,
        groupType: created.groupType,
        sortOrder: String(created.sortOrder),
        isActive: String(created.isActive)
      },
      source: "ui_edit"
    });

    return created;
  }

  async update(input: UpdateGroupInput) {
    let current;
    try {
      current = await this.prisma.group.findUniqueOrThrow({ where: { id: input.groupId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundError(`Group not found: ${input.groupId}`);
      }
      throw e;
    }

    if (input.groupType !== undefined && !isGroupType(input.groupType)) {
      throw new Error("Invalid groupType");
    }

    const updated = await this.prisma.group.update({
      where: { id: input.groupId },
      data: {
        name: input.name ?? undefined,
        groupType: input.groupType ?? undefined,
        sortOrder: input.sortOrder ?? undefined
      }
    });

    const changes = diffFields(current, updated, TRACKED_GROUP_FIELDS);
    await this.audit.logUpdate({
      userId: input.updatedBy,
      tableName: "Group",
      recordId: current.id,
      changes,
      reason: input.reason,
      source: "ui_edit"
    });

    return updated;
  }

  async archive(input: ArchiveGroupInput) {
    let current;
    try {
      current = await this.prisma.group.findUniqueOrThrow({ where: { id: input.groupId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundError(`Group not found: ${input.groupId}`);
      }
      throw e;
    }

    if (!current.isActive) {
      throw new AlreadyArchivedError("Group is already archived");
    }

    const updated = await this.prisma.group.update({
      where: { id: input.groupId },
      data: {
        isActive: false,
        archivedAt: new Date()
      }
    });

    await this.audit.logArchive({
      userId: input.archivedBy,
      tableName: "Group",
      recordId: current.id,
      reason: input.reason,
      source: "ui_edit"
    });

    return updated;
  }
}
