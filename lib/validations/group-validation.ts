import type { CreateGroupInput, GroupType, UpdateGroupInput } from "../groups/types";

const VALID_GROUP_TYPES: GroupType[] = ["sector", "non_operating", "custom"];
const MAX_NAME_LENGTH = 100;

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate input for creating a group.
 */
export function validateCreateGroup(input: CreateGroupInput): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (input.name.trim().length > MAX_NAME_LENGTH) {
    errors.push({ field: "name", message: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
  }

  if (!input.groupType) {
    errors.push({ field: "groupType", message: "Group type is required" });
  } else if (!VALID_GROUP_TYPES.includes(input.groupType)) {
    errors.push({
      field: "groupType",
      message: `Group type must be one of: ${VALID_GROUP_TYPES.join(", ")}`
    });
  }

  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
      errors.push({ field: "sortOrder", message: "Sort order must be a non-negative integer" });
    }
  }

  if (!input.createdBy || input.createdBy.trim().length === 0) {
    errors.push({ field: "createdBy", message: "Created by user ID is required" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate input for updating a group.
 */
export function validateUpdateGroup(input: UpdateGroupInput): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.groupId || input.groupId.trim().length === 0) {
    errors.push({ field: "groupId", message: "Group ID is required" });
  }

  if (input.name !== undefined) {
    if (input.name.trim().length === 0) {
      errors.push({ field: "name", message: "Name cannot be empty" });
    } else if (input.name.trim().length > MAX_NAME_LENGTH) {
      errors.push({
        field: "name",
        message: `Name must be ${MAX_NAME_LENGTH} characters or fewer`
      });
    }
  }

  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
      errors.push({ field: "sortOrder", message: "Sort order must be a non-negative integer" });
    }
  }

  if (!input.updatedBy || input.updatedBy.trim().length === 0) {
    errors.push({ field: "updatedBy", message: "Updated by user ID is required" });
  }

  return { valid: errors.length === 0, errors };
}
