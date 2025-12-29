import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Public routes
    const publicRoutes = ["/login", "/api/auth", "/unauthorized", "/not-authorized"];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (isPublicRoute) {
        return NextResponse.next();
    }

    // Get the token using next-auth/jwt
    const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    });

    console.log("[Middleware] Path:", pathname);
    console.log("[Middleware] Secret configured:", !!process.env.NEXTAUTH_SECRET);
    console.log("[Middleware] Token found:", !!token);

    // Redirect to login if not authenticated
    if (!token) {
        console.log("[Middleware] No token, redirecting to login");
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Check if user is authorized
    const isAuthorized = token.isAuthorized as boolean;
    if (!isAuthorized) {
        return NextResponse.redirect(new URL("/not-authorized", request.url));
    }

    // Role-based access control
    const role = ((token.role as string) || "").toLowerCase();

    // Route access rules based on user's requirements
    // investigator/campus manager: investigation, archives
    // approver: investigation, archives, decision (judgement)
    // admin: investigation, archives, decision

    const routeAccess: Record<string, string[]> = {
        "/investigation-hub": ["investigator", "campus manager", "approver", "admin"],
        "/decision-hub": ["approver", "admin"],
        "/archives": ["investigator", "campus manager", "approver", "admin"],
    };

    // Check if user has access to the route
    for (const [route, allowedRoles] of Object.entries(routeAccess)) {
        if (pathname.startsWith(route) && !allowedRoles.includes(role)) {
            return NextResponse.redirect(new URL("/unauthorized", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
