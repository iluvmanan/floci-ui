import { type NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/register"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const hasToken = request.cookies.has("access_token")

  if (!isPublic && !hasToken) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isPublic && hasToken && !pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
