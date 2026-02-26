import { NextResponse } from "next/server";
import { unlockSnapshot } from "@/lib/snapshots/http-handlers";
import { snapshotService } from "@/lib/snapshots/service-factory";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await unlockSnapshot(snapshotService, body);
  return NextResponse.json(result.body, { status: result.status });
}
