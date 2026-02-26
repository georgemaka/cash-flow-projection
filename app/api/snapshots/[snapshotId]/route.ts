import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshots/http-handlers";
import { snapshotService } from "@/lib/snapshots/service-factory";

export async function GET(_request: Request, { params }: { params: { snapshotId: string } }) {
  const result = await getSnapshot(snapshotService, params.snapshotId);
  return NextResponse.json(result.body, { status: result.status });
}
