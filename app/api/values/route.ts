import { NextResponse } from "next/server";
import { listValues } from "../../../lib/values/http-handlers";
import { valueService } from "../../../lib/values/service-factory";
import { requireSignedIn } from "@/lib/auth";

export async function GET(request: Request) {
  const guard = await requireSignedIn();
  if (guard) return guard;

  const url = new URL(request.url);
  const snapshotId = url.searchParams.get("snapshotId");
  const groupId = url.searchParams.get("groupId") ?? undefined;

  const result = await listValues(valueService, snapshotId, groupId);
  return NextResponse.json(result.body, { status: result.status });
}
