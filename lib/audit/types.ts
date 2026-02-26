/**
 * Audit source taxonomy — must stay in sync with AuditSource enum in prisma/schema.prisma.
 */
export type AuditSource = "ui_edit" | "import" | "bulk_action" | "api";

/**
 * Tables that support audit logging.
 * Matches the Prisma model names used in tableName field.
 */
export type AuditableTable = "Group" | "LineItem" | "Snapshot" | "Value";

/**
 * A single field-level change to be logged.
 */
export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Input for creating audit log entries.
 */
export interface AuditEntryInput {
  userId: string | null;
  tableName: AuditableTable;
  recordId: string;
  changes: FieldChange[];
  reason?: string;
  source: AuditSource;
}

/**
 * Input for logging a record creation (all fields are "new").
 */
export interface AuditCreateInput {
  userId: string | null;
  tableName: AuditableTable;
  recordId: string;
  fields: Record<string, string | null>;
  source: AuditSource;
}

/**
 * Input for logging a record archive/soft-delete.
 */
export interface AuditArchiveInput {
  userId: string | null;
  tableName: AuditableTable;
  recordId: string;
  reason?: string;
  source: AuditSource;
}

/**
 * Compares two objects and returns the field-level changes between them.
 * Only includes fields that actually changed.
 * Values are coerced to strings for storage (Decimal, Date, boolean, etc.).
 */
export function diffFields(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  fieldsToTrack: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of fieldsToTrack) {
    const oldVal = serializeValue(oldRecord[field]);
    const newVal = serializeValue(newRecord[field]);

    if (oldVal !== newVal) {
      changes.push({ field, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

/**
 * Serialize a value to a string for audit storage.
 * Returns null for null/undefined.
 */
function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toFixed" in value) {
    // Prisma Decimal type
    return String(value);
  }
  return String(value);
}
