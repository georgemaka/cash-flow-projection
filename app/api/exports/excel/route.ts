import { NextRequest, NextResponse } from "next/server";
import { generateExcelExport } from "@/lib/exports";
import type { ExportSnapshotData } from "@/lib/exports";
import { requireSignedIn } from "@/lib/auth";

/**
 * GET /api/exports/excel?snapshotId=xxx
 *
 * Generates and returns an XLSX file for the specified snapshot.
 * In Phase 1, this accepts the export data in the request body (POST)
 * since the full Prisma data assembly pipeline isn't built yet.
 */
export async function POST(request: NextRequest) {
  const guard = await requireSignedIn();
  if (guard) return guard;

  try {
    const body = (await request.json()) as ExportSnapshotData;

    if (!body.snapshotName || !body.periods || !body.groups) {
      return NextResponse.json({ error: "Missing required export data" }, { status: 400 });
    }

    const buffer = await generateExcelExport(body);

    const filename = `${body.snapshotName.replace(/[^a-zA-Z0-9 -]/g, "")}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length)
      }
    });
  } catch (error) {
    console.error("[Excel Export] Failed:", error);
    return NextResponse.json({ error: "Failed to generate Excel export" }, { status: 500 });
  }
}
