import type { TemplateService } from "./template-service";

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * POST /api/templates/preview
 * Body: { sourceSnapshotId: string, targetYear: number }
 */
export async function previewTemplate(
  service: TemplateService,
  body: unknown
): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const { sourceSnapshotId, targetYear } = body as {
    sourceSnapshotId?: string;
    targetYear?: number;
  };

  if (!sourceSnapshotId || typeof sourceSnapshotId !== "string") {
    return { status: 400, body: { error: "sourceSnapshotId is required" } };
  }

  if (!targetYear || typeof targetYear !== "number" || !Number.isInteger(targetYear)) {
    return { status: 400, body: { error: "targetYear must be an integer" } };
  }

  if (targetYear < 2000 || targetYear > 2100) {
    return { status: 400, body: { error: "targetYear must be between 2000 and 2100" } };
  }

  try {
    const preview = await service.preview(sourceSnapshotId, targetYear);
    return { status: 200, body: preview };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("not found") || message.includes("No Snapshot found")) {
      return { status: 404, body: { error: "Source snapshot not found" } };
    }

    if (message.includes("Can only onboard from a locked snapshot")) {
      return { status: 409, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to generate preview" } };
  }
}

/**
 * POST /api/templates/onboard
 * Body: { sourceSnapshotId: string, name: string, targetYear: number, createdBy: string }
 */
export async function onboardTemplate(
  service: TemplateService,
  body: unknown
): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const { sourceSnapshotId, name, targetYear, createdBy } = body as {
    sourceSnapshotId?: string;
    name?: string;
    targetYear?: number;
    createdBy?: string;
  };

  if (!sourceSnapshotId || typeof sourceSnapshotId !== "string") {
    return { status: 400, body: { error: "sourceSnapshotId is required" } };
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return { status: 400, body: { error: "name is required" } };
  }

  if (!targetYear || typeof targetYear !== "number" || !Number.isInteger(targetYear)) {
    return { status: 400, body: { error: "targetYear must be an integer" } };
  }

  if (targetYear < 2000 || targetYear > 2100) {
    return { status: 400, body: { error: "targetYear must be between 2000 and 2100" } };
  }

  if (!createdBy || typeof createdBy !== "string") {
    return { status: 400, body: { error: "createdBy is required" } };
  }

  try {
    const snapshot = await service.onboard({
      sourceSnapshotId,
      name: name.trim(),
      targetYear,
      createdBy
    });
    return { status: 201, body: snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("not found") || message.includes("No Snapshot found")) {
      return { status: 404, body: { error: "Source snapshot not found" } };
    }

    if (message.includes("Can only onboard from a locked snapshot")) {
      return { status: 409, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to create snapshot from template" } };
  }
}
