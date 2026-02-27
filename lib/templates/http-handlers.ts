import type { TemplateService } from "./template-service";
import { previewTemplateSchema, onboardTemplateSchema, firstZodError } from "@/lib/validations";

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
  const result = previewTemplateSchema.safeParse(body);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { sourceSnapshotId, targetYear } = result.data;
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
  const result = onboardTemplateSchema.safeParse(body);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { sourceSnapshotId, name, targetYear, createdBy } = result.data;
  try {
    const snapshot = await service.onboard({ sourceSnapshotId, name, targetYear, createdBy });
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
