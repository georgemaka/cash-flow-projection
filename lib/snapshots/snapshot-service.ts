import type { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
import type { AuditService } from "../audit";
import type {
  CopySnapshotInput,
  CreateSnapshotInput,
  LockSnapshotInput,
  UnlockSnapshotInput
} from "./types";
import { parseAsOfMonth } from "./types";

/**
 * Snapshot lifecycle service.
 *
 * Snapshots progress through: draft -> locked (-> draft if reopened).
 * Locking captures a StructureVersion so the report shape is reproducible.
 * Copying creates a new draft pre-filled with the source's projected values
 * (actuals are NOT copied -- per ADR-003 new snapshots start fresh).
 */
export class SnapshotService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService
  ) {}

  /**
   * Create a new draft snapshot.
   */
  async create(input: CreateSnapshotInput) {
    const snapshot = await this.prisma.snapshot.create({
      data: {
        name: input.name,
        asOfMonth: parseAsOfMonth(input.asOfMonth),
        status: "draft",
        createdBy: input.createdBy
      }
    });

    await this.audit.logCreate({
      userId: input.createdBy,
      tableName: "Snapshot",
      recordId: snapshot.id,
      fields: {
        name: input.name,
        asOfMonth: input.asOfMonth,
        status: "draft"
      },
      source: "ui_edit"
    });

    return snapshot;
  }

  /**
   * Lock a draft snapshot (admin-only).
   * Creates a StructureVersion capturing the current report shape.
   */
  async lock(input: LockSnapshotInput) {
    const snapshot = await this.prisma.snapshot.findUniqueOrThrow({
      where: { id: input.snapshotId }
    });

    if (snapshot.status === "locked") {
      throw new Error("Snapshot is already locked");
    }

    // Create structure version and update snapshot in a transaction.
    // The WHERE clause includes `status: "draft"` so that if a concurrent
    // request already locked the snapshot, Prisma throws P2025 and the
    // transaction rolls back — preventing a double-lock.
    const result = await this.prisma.$transaction(async (tx: TxClient) => {
      const structureVersion = await tx.structureVersion.create({
        data: { snapshotId: snapshot.id }
      });

      const updated = await tx.snapshot.update({
        where: { id: snapshot.id, status: "draft" },
        data: {
          status: "locked",
          lockedBy: input.lockedBy,
          lockedAt: new Date(),
          structureVersionId: structureVersion.id
        }
      });

      return updated;
    });

    await this.audit.logSnapshotStatusChange(
      input.lockedBy,
      snapshot.id,
      "draft",
      "locked",
      input.reason ?? null,
      "ui_edit"
    );

    return result;
  }

  /**
   * Unlock (reopen) a locked snapshot (admin-only).
   * Sets status back to draft. Does NOT delete the StructureVersion.
   */
  async unlock(input: UnlockSnapshotInput) {
    const snapshot = await this.prisma.snapshot.findUniqueOrThrow({
      where: { id: input.snapshotId }
    });

    if (snapshot.status === "draft") {
      throw new Error("Snapshot is already unlocked");
    }

    // Include status: "locked" in WHERE so a concurrent re-lock between the
    // pre-check and this update fails atomically (Prisma P2025) rather than
    // silently overwriting the re-locked state.
    const updated = await this.prisma.snapshot.update({
      where: { id: snapshot.id, status: "locked" },
      data: {
        status: "draft",
        lockedBy: null,
        lockedAt: null
      }
    });

    await this.audit.logSnapshotStatusChange(
      input.unlockedBy,
      snapshot.id,
      "locked",
      "draft",
      input.reason ?? null,
      "ui_edit"
    );

    return updated;
  }

  /**
   * Copy a locked snapshot's projected values into a new draft.
   * Actuals are NOT copied (ADR-003: new snapshots start fresh for actuals).
   */
  async copyFromPrior(input: CopySnapshotInput) {
    const source = await this.prisma.snapshot.findUniqueOrThrow({
      where: { id: input.sourceSnapshotId }
    });

    if (source.status !== "locked") {
      throw new Error("Can only copy from a locked snapshot");
    }

    const sourceValues = await this.prisma.value.findMany({
      where: { snapshotId: source.id }
    });

    const result = await this.prisma.$transaction(async (tx: TxClient) => {
      const newSnapshot = await tx.snapshot.create({
        data: {
          name: input.name,
          asOfMonth: parseAsOfMonth(input.asOfMonth),
          status: "draft",
          createdBy: input.createdBy
        }
      });

      if (sourceValues.length > 0) {
        await tx.value.createMany({
          data: sourceValues.map((v) => ({
            lineItemId: v.lineItemId,
            snapshotId: newSnapshot.id,
            period: v.period,
            projectedAmount: v.projectedAmount,
            actualAmount: null,
            note: null,
            updatedBy: input.createdBy
          }))
        });
      }

      return newSnapshot;
    });

    await this.audit.logCreate({
      userId: input.createdBy,
      tableName: "Snapshot",
      recordId: result.id,
      fields: {
        name: input.name,
        asOfMonth: input.asOfMonth,
        status: "draft",
        copiedFrom: input.sourceSnapshotId
      },
      source: "ui_edit"
    });

    return result;
  }

  /**
   * List all snapshots, ordered by creation date descending.
   */
  async list() {
    return this.prisma.snapshot.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        locker: { select: { id: true, name: true, email: true } }
      }
    });
  }

  /**
   * Get a single snapshot by ID with related data.
   */
  async getById(snapshotId: string) {
    return this.prisma.snapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        locker: { select: { id: true, name: true, email: true } },
        structureVersion: true
      }
    });
  }
}
