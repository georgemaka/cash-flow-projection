import type { PrismaClient } from "@prisma/client";
import type {
  AuditArchiveInput,
  AuditCreateInput,
  AuditEntryInput,
  AuditSource,
  AuditableTable,
  FieldChange
} from "./types";

/**
 * Field-level audit logging service.
 *
 * Design principles:
 * - Append-only: audit entries are never modified or deleted.
 * - Resilient: audit failures are logged to console but don't break the mutation.
 *   (A failed audit write should not roll back a valid business operation.)
 * - Batch-friendly: multiple field changes for one record are written as separate rows
 *   in a single transaction for consistency.
 */
export class AuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log field-level changes for an update operation.
   * Creates one audit row per changed field.
   * Skips silently if there are no changes.
   */
  async logUpdate(input: AuditEntryInput): Promise<void> {
    if (input.changes.length === 0) return;

    try {
      await this.writeEntries(
        input.userId,
        input.tableName,
        input.recordId,
        input.changes,
        input.reason ?? null,
        input.source
      );
    } catch (error) {
      console.error("[AuditService] Failed to write update audit entries:", error);
    }
  }

  /**
   * Log all fields for a newly created record.
   * Each field gets an entry with oldValue=null and newValue=current.
   */
  async logCreate(input: AuditCreateInput): Promise<void> {
    const changes: FieldChange[] = Object.entries(input.fields)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([field, value]) => ({
        field,
        oldValue: null,
        newValue: value
      }));

    if (changes.length === 0) return;

    try {
      await this.writeEntries(
        input.userId,
        input.tableName,
        input.recordId,
        changes,
        null,
        input.source
      );
    } catch (error) {
      console.error("[AuditService] Failed to write create audit entries:", error);
    }
  }

  /**
   * Log an archive (soft-delete) operation.
   * Records the isActive field change from true to false.
   */
  async logArchive(input: AuditArchiveInput): Promise<void> {
    const changes: FieldChange[] = [{ field: "isActive", oldValue: "true", newValue: "false" }];

    try {
      await this.writeEntries(
        input.userId,
        input.tableName,
        input.recordId,
        changes,
        input.reason ?? null,
        input.source
      );
    } catch (error) {
      console.error("[AuditService] Failed to write archive audit entries:", error);
    }
  }

  /**
   * Log a snapshot status change (draft → locked or locked → draft).
   */
  async logSnapshotStatusChange(
    userId: string | null,
    snapshotId: string,
    oldStatus: string,
    newStatus: string,
    reason: string | null,
    source: AuditSource
  ): Promise<void> {
    const changes: FieldChange[] = [{ field: "status", oldValue: oldStatus, newValue: newStatus }];

    try {
      await this.writeEntries(userId, "Snapshot", snapshotId, changes, reason, source);
    } catch (error) {
      console.error("[AuditService] Failed to write snapshot status audit:", error);
    }
  }

  /**
   * Query audit history for a specific record.
   * Returns entries ordered by timestamp descending (most recent first).
   */
  async getHistory(tableName: AuditableTable, recordId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { tableName, recordId },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } }
    });
  }

  /**
   * Query audit history for a specific field on a specific record.
   */
  async getFieldHistory(tableName: AuditableTable, recordId: string, field: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { tableName, recordId, field },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } }
    });
  }

  /**
   * Internal: write audit entries in a batch.
   * Uses createMany for efficiency — all entries get the same timestamp.
   */
  private async writeEntries(
    userId: string | null,
    tableName: AuditableTable,
    recordId: string,
    changes: FieldChange[],
    reason: string | null,
    source: AuditSource
  ): Promise<void> {
    const now = new Date();

    await this.prisma.auditLog.createMany({
      data: changes.map((change) => ({
        userId,
        tableName,
        recordId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason,
        source,
        timestamp: now
      }))
    });
  }
}
