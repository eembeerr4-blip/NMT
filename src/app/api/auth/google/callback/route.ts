import { NextRequest, NextResponse } from "next/server";
import { finishGoogleAuth } from "@/server/google-oauth";

export async function GET(request: NextRequest) {
  let destination = "/login?oauth=failed";
  try {
    destination = await finishGoogleAuth(
      request.nextUrl.searchParams.get("code") ?? "",
      request.nextUrl.searchParams.get("state") ?? "",
    );
  } catch { /* Avoid exposing OAuth internals in the URL. */ }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
