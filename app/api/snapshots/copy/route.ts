import { NextResponse } from "next/server";
import { copySnapshot } from "@/lib/snapshots/http-handlers";
import { snapshotService } from "@/lib/snapshots/service-factory";
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

  const result = await copySnapshot(snapshotService, body);
  return NextResponse.json(result.body, { status: result.status });
}
