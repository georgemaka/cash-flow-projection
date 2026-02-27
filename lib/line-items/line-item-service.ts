import { type PrismaClient, Prisma } from "@prisma/client";
import { diffFields, type AuditService } from "../audit";
import { AlreadyArchivedError, NotFoundError } from "@/lib/errors";
import type {
  ArchiveLineItemInput,
  CreateLineItemInput,
  ProjectionMethod,
  UpdateLineItemInput
} from "./types";

const TRACKED_FIELDS = [
  "groupId",
  "label",
  "projectionMethod",
  "projectionParams",
  "sortOrder",
  "isActive",
  "archivedAt"
];

function isProjectionMethod(value: unknown): value is ProjectionMethod {
  return (
    value === "manual" ||
    value === "annual_spread" ||
    value === "prior_year_pct" ||
    value === "prior_year_flat" ||
    value === "custom_formula"
  );
}

export class LineItemService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService
  ) {}

  async list(input?: { groupId?: string; includeInactive?: boolean }) {
    const where: { groupId?: string; isActive?: boolean } = {};

    if (input?.groupId) {
      where.groupId = input.groupId;
    }

    if (!input?.includeInactive) {
      where.isActive = true;
    }

    return this.prisma.lineItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async getById(lineItemId: string) {
    try {
      return await this.prisma.lineItem.findUniqueOrThrow({ where: { id: lineItemId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundError(`Line item not found: ${lineItemId}`);
      }
      throw e;
    }
  }

  async create(input: CreateLineItemInput) {
    const method = input.projectionMethod ?? "manual";

    if (!isProjectionMethod(method)) {
      throw new Error("Invalid projectionMethod");
    }

    const created = await this.prisma.lineItem.create({
      data: {
        groupId: input.groupId,
        label: input.label,
        projectionMethod: method,
        projectionParams: input.projectionParams as never,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.audit.logCreate({
      userId: input.createdBy,
      tableName: "LineItem",
      recordId: created.id,
      fields: {
        groupId: created.groupId,
        label: created.label,
        projectionMethod: created.projectionMethod,
        sortOrder: String(created.sortOrder),
        isActive: String(created.isActive)
      },
      source: "ui_edit"
    });

    return created;
  }

  async update(input: UpdateLineItemInput) {
    let current;
    try {
      current = await this.prisma.lineItem.findUniqueOrThrow({
        where: { id: input.lineItemId }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundError(`Line item not found: ${input.lineItemId}`);
      }
      throw e;
    }

    if (input.projectionMethod !== undefined && !isProjectionMethod(input.projectionMethod)) {
      throw new Error("Invalid projectionMethod");
    }

    const updated = await this.prisma.lineItem.update({
      where: { id: input.lineItemId },
      data: {
        groupId: input.groupId ?? undefined,
        label: input.label ?? undefined,
        projectionMethod: input.projectionMethod ?? undefined,
        projectionParams: input.projectionParams as never,
        sortOrder: input.sortOrder ?? undefined
      }
    });

    const changes = diffFields(
      current as Record<string, unknown>,
      updated as Record<string, unknown>,
      TRACKED_FIELDS
    );
    await this.audit.logUpdate({
      userId: input.updatedBy,
      tableName: "LineItem",
      recordId: current.id,
      changes,
      reason: input.reason,
      source: "ui_edit"
    });

    return updated;
  }

  async archive(input: ArchiveLineItemInput) {
    let current;
    try {
      current = await this.prisma.lineItem.findUniqueOrThrow({
        where: { id: input.lineItemId }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundError(`Line item not found: ${input.lineItemId}`);
      }
      throw e;
    }

    if (!current.isActive) {
      throw new AlreadyArchivedError("Line item is already archived");
    }

    const updated = await this.prisma.lineItem.update({
      where: { id: input.lineItemId },
      data: {
        isActive: false,
        archivedAt: new Date()
      }
    });

    await this.audit.logArchive({
      userId: input.archivedBy,
      tableName: "LineItem",
      recordId: current.id,
      reason: input.reason,
      source: "ui_edit"
    });

    return updated;
  }
}
