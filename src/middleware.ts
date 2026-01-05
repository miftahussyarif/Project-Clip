import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'clipgenius-auth';

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/settings'];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ['/login'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
    const isAuthenticated = !!authCookie?.value;

    // Check if accessing protected route without auth
    if (protectedRoutes.some(route => pathname.startsWith(route))) {
        if (!isAuthenticated) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Check if accessing auth route while already logged in
    if (authRoutes.some(route => pathname.startsWith(route))) {
        if (isAuthenticated) {
            const dashboardUrl = new URL('/dashboard', request.url);
            return NextResponse.redirect(dashboardUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/settings/:path*', '/login'],
};
