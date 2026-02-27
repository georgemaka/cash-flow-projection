import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshots/http-handlers";
import { snapshotService } from "@/lib/snapshots/service-factory";
import { requireSignedIn } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: { snapshotId: string } }) {
  const guard = await requireSignedIn();
  if (guard) return guard;

  const result = await getSnapshot(snapshotService, params.snapshotId);
  return NextResponse.json(result.body, { status: result.status });
}
