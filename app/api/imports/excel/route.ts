import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { excelImportService } from "@/lib/imports/service-factory";

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
  }

  const modeRaw = String(formData.get("mode") ?? "preview").toLowerCase();
  const mode = modeRaw === "confirm" ? "confirm" : "preview";
  const snapshotId = String(formData.get("snapshotId") ?? "").trim();

  if (mode === "confirm" && !snapshotId) {
    return NextResponse.json({ error: "snapshotId is required for confirm mode" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const parsed = await excelImportService.parseWorkbook(Buffer.from(bytes));

    if (mode === "preview") {
      const summary = excelImportService.summarize(parsed);
      return NextResponse.json({
        mode,
        summary
      });
    }

    const summary = await excelImportService.confirmImport(snapshotId, parsed);
    return NextResponse.json({
      mode,
      summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Excel import failed";
    const status = message.includes("not found") || message.includes("locked") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
