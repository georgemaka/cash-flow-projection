import { NextResponse } from "next/server";
import { createGroup, listGroups } from "@/lib/groups/http-handlers";
import { groupService } from "@/lib/groups/service-factory";
import { requireAdmin, requireSignedIn } from "@/lib/auth";

export async function GET(request: Request) {
  const guard = await requireSignedIn();
  if (guard) return guard;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const result = await listGroups(groupService, includeInactive);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createGroup(groupService, body);
  return NextResponse.json(result.body, { status: result.status });
}
