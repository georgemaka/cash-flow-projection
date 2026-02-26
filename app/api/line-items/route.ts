import { NextResponse } from "next/server";
import { createLineItem, listLineItems } from "../../../lib/line-items/http-handlers";
import { lineItemService } from "../../../lib/line-items/service-factory";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId") ?? undefined;
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const result = await listLineItems(lineItemService, groupId, includeInactive);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createLineItem(lineItemService, body);
  return NextResponse.json(result.body, { status: result.status });
}
