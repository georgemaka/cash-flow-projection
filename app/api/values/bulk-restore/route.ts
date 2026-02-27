import { NextResponse } from "next/server";
import { handleBulkRestore } from "@/lib/values/bulk-http-handlers";
import { bulkValueService } from "@/lib/values/bulk-factory";
import { requireEditorOrAbove } from "@/lib/auth";

export async function POST(request: Request) {
  const guard = await requireEditorOrAbove();
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await handleBulkRestore(bulkValueService, body);
  return NextResponse.json(result.body, { status: result.status });
}
