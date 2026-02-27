import { NextResponse } from "next/server";
import { unlockSnapshot } from "@/lib/snapshots/http-handlers";
import { snapshotService } from "@/lib/snapshots/service-factory";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await unlockSnapshot(snapshotService, body);
  return NextResponse.json(result.body, { status: result.status });
}
