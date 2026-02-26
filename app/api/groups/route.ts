import { NextResponse } from "next/server";
import { createGroup, listGroups } from "@/lib/groups/http-handlers";
import { groupService } from "@/lib/groups/service-factory";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const result = await listGroups(groupService, includeInactive);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createGroup(groupService, body);
  return NextResponse.json(result.body, { status: result.status });
}
