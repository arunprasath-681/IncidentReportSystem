import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const pathname = req.nextUrl.pathname;
    const session = req.auth;

    console.log("[Middleware] Path:", pathname);
    console.log("[Middleware] Session present:", !!session);
    if (session) {
        console.log("[Middleware] User Email:", session.user?.email);
        console.log("[Middleware] Is Authorized:", session.user?.isAuthorized);
    }

    // Public routes (don't require session)
    const publicRoutes = ["/login", "/api/auth", "/unauthorized", "/not-authorized"];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (isPublicRoute) {
        return NextResponse.next();
    }

    // NextAuth v5: req.auth contains the session
    if (!session) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Check if user is authorized
    if (!session.user?.isAuthorized) {
        return NextResponse.redirect(new URL("/not-authorized", req.url));
    }

    // Role-based access control
    const role = (session.user.role || "").toLowerCase();
    const routeAccess: Record<string, string[]> = {
        "/investigation-hub": ["investigator", "campus manager", "approver", "admin"],
        "/decision-hub": ["approver", "admin"],
        "/archives": ["investigator", "campus manager", "approver", "admin"],
    };

    for (const [route, allowedRoles] of Object.entries(routeAccess)) {
        if (pathname.startsWith(route) && !allowedRoles.includes(role)) {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
