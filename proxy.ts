import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed middleware.ts → proxy.ts.
// Fast first check: no demo-role cookie → send to the role picker.
// (Each page still checks the role on the server with requireUser.)
export function proxy(request: NextRequest) {
  if (!request.cookies.has("demo_user")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/report", "/my-requests", "/requests/:path*", "/tech/:path*", "/admin/:path*"],
};
