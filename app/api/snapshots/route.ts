import { NextResponse } from "next/server";
import { createSnapshot, listSnapshots } from "@/lib/snapshots/http-handlers";
import { snapshotService } from "@/lib/snapshots/service-factory";
import { requireEditorOrAbove, requireSignedIn } from "@/lib/auth";

export async function GET() {
  const guard = await requireSignedIn();
  if (guard) return guard;

  const result = await listSnapshots(snapshotService);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const guard = await requireEditorOrAbove();
  if (guard) return guard;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createSnapshot(snapshotService, body);
  return NextResponse.json(result.body, { status: result.status });
}
