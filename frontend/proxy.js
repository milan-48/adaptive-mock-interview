import { NextResponse } from "next/server";

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isStaffRole(role) {
  return role === "admin" || role === "staff";
}

export function proxy(request) {
  const token = request.cookies.get("ami_auth_token")?.value;
  const { pathname } = request.nextUrl;

  const isPublicLogin = pathname === "/login";
  const isHome = pathname === "/";
  const isAdminArea = pathname.startsWith("/admin");
  const isCandidateArea = pathname.startsWith("/dashboard");

  if (!token) {
    if (isPublicLogin) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);
  const role = payload?.role;

  if (isHome || isPublicLogin) {
    const target = isStaffRole(role) ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isAdminArea && !isStaffRole(role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isCandidateArea && isStaffRole(role)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
