import { NextResponse } from "next/server";
import {
  archiveLineItem,
  getLineItem,
  updateLineItem
} from "../../../../lib/line-items/http-handlers";
import { lineItemService } from "../../../../lib/line-items/service-factory";
import { requireAdmin, requireSignedIn } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: { lineItemId: string } }) {
  const guard = await requireSignedIn();
  if (guard) return guard;

  const result = await getLineItem(lineItemService, params.lineItemId);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: Request, { params }: { params: { lineItemId: string } }) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    ...(typeof body === "object" && body ? body : {}),
    lineItemId: params.lineItemId
  };

  const result = await updateLineItem(lineItemService, payload);
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(request: Request, { params }: { params: { lineItemId: string } }) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = {
    ...(typeof body === "object" && body ? body : {}),
    lineItemId: params.lineItemId
  };

  const result = await archiveLineItem(lineItemService, payload);
  return NextResponse.json(result.body, { status: result.status });
}
