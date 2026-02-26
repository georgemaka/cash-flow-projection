import { NextResponse } from "next/server";
import { archiveGroup, getGroup, updateGroup } from "@/lib/groups/http-handlers";
import { groupService } from "@/lib/groups/service-factory";

export async function GET(_request: Request, { params }: { params: { groupId: string } }) {
  const result = await getGroup(groupService, params.groupId);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: Request, { params }: { params: { groupId: string } }) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    ...(typeof body === "object" && body ? body : {}),
    groupId: params.groupId
  };

  const result = await updateGroup(groupService, payload);
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(request: Request, { params }: { params: { groupId: string } }) {
  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = {
    ...(typeof body === "object" && body ? body : {}),
    groupId: params.groupId
  };

  const result = await archiveGroup(groupService, payload);
  return NextResponse.json(result.body, { status: result.status });
}
