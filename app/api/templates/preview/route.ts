import { NextResponse } from "next/server";
import { previewTemplate } from "@/lib/templates/http-handlers";
import { templateService } from "@/lib/templates/service-factory";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await previewTemplate(templateService, body);
  return NextResponse.json(result.body, { status: result.status });
}
