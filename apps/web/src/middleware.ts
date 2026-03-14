import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const authOnlyRoutes = ["/questions/ask"];
const authPageRoutes = ["/sign-in", "/sign-up"];
const accessCookie = "devoverflow_access_token";
const refreshCookie = "devoverflow_refresh_token";

function isProtectedPath(pathname: string) {
  return (
    authOnlyRoutes.includes(pathname) ||
    /^\/questions\/[^/]+\/edit$/.test(pathname)
  );
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(
    request.cookies.get(accessCookie)?.value ||
      request.cookies.get(refreshCookie)?.value,
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = hasSessionCookie(request);

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (authPageRoutes.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/questions/:path*", "/sign-in", "/sign-up"],
};
