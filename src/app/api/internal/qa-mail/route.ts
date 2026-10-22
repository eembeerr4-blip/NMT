import { NextResponse } from "next/server";
import { isQaMailSinkEnabled } from "@/lib/qa-mail";

export const dynamic = "force-dynamic";

/** Local-only sink for auth emails when E2E/CI redirects mail here. Never echoes request bodies. */
export async function POST(request: Request) {
  if (!isQaMailSinkEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await request.json().catch(() => null);
  return NextResponse.json({ id: "qa-mail-stub" });
}
