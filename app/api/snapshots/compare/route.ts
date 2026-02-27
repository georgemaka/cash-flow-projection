import { type NextRequest, NextResponse } from "next/server";
import { compareSnapshots } from "@/lib/snapshots/http-handlers";
import { compareService } from "@/lib/snapshots/compare-factory";
import { requireSignedIn } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const guard = await requireSignedIn();
  if (guard) return guard;

  const { searchParams } = request.nextUrl;
  const a = searchParams.get("a");
  const b = searchParams.get("b");

  const result = await compareSnapshots(compareService, a, b);
  return NextResponse.json(result.body, { status: result.status });
}
