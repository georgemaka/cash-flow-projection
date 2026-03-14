/**
 * Typed error classes for the service layer.
 *
 * Services throw these; HTTP handlers check with instanceof instead of
 * inspecting error.message strings.
 */

/** Thrown when a requested record does not exist. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown when attempting to lock an already-locked snapshot. */
export class AlreadyLockedError extends Error {
  constructor(message = "Snapshot is already locked") {
    super(message);
    this.name = "AlreadyLockedError";
  }
}

/** Thrown when attempting to unlock an already-draft (unlocked) snapshot. */
export class AlreadyUnlockedError extends Error {
  constructor(message = "Snapshot is already unlocked") {
    super(message);
    this.name = "AlreadyUnlockedError";
  }
}

/** Thrown when attempting to copy from a snapshot that is not locked. */
export class SourceNotLockedError extends Error {
  constructor(message = "Can only copy from a locked snapshot") {
    super(message);
    this.name = "SourceNotLockedError";
  }
}

/** Thrown when attempting to archive a group or line item that is already inactive. */
export class AlreadyArchivedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlreadyArchivedError";
  }
}

/** Thrown when a mutation is attempted on a locked snapshot. */
export class LockedSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockedSnapshotError";
  }
}

/**
 * Check if an error is a Prisma "not found" error (P2025).
 * Works without requiring generated Prisma client types.
 */
export function isPrismaNotFound(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2025"
  );
}
