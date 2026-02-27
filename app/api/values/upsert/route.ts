import { NextResponse } from "next/server";
import { upsertValue } from "../../../../lib/values/http-handlers";
import { valueService } from "../../../../lib/values/service-factory";
import { requireEditorOrAbove } from "@/lib/auth";

export async function POST(request: Request) {
  const guard = await requireEditorOrAbove();
  if (guard) return guard;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await upsertValue(valueService, body);
  return NextResponse.json(result.body, { status: result.status });
}
