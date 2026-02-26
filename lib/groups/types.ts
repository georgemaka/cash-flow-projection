/**
 * Group types — must stay in sync with GroupType enum in prisma/schema.prisma.
 * Defined locally so the code compiles before `prisma generate`.
 */
export type GroupType = "sector" | "non_operating" | "custom";

export interface CreateGroupInput {
  name: string;
  groupType: GroupType;
  sortOrder?: number;
  createdBy: string | null;
}

export interface UpdateGroupInput {
  groupId: string;
  name?: string;
  groupType?: GroupType;
  sortOrder?: number;
  updatedBy: string | null;
  reason?: string;
}

export interface ArchiveGroupInput {
  groupId: string;
  archivedBy: string | null;
  reason?: string;
}
