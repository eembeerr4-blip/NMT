import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/onboarding") || pathname.startsWith("/_next")) return NextResponse.next();
  if (!request.cookies.get("nmt_user")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const expected = createHash("sha256").update(`nmt-academy:${password}`).digest("hex");
  if (request.cookies.get("nmt_session")?.value === expected) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
