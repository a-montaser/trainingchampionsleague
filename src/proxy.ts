import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next 16 renamed `middleware` to `proxy`. This runs before matching routes.
 *
 * It is a convenience only: it bounces obviously signed-out visitors away from
 * the admin site without a round-trip through a page render. It checks for the
 * presence of a cookie, never its validity, and is NOT the authorisation
 * boundary — every admin page, action and route handler calls `requireAdmin()`
 * itself, which re-reads the session and role from the database.
 */

const ADMIN_COOKIE = 'tcl_a_session';
const PARTICIPANT_COOKIE = 'tcl_p_session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();
    if (!request.cookies.has(ADMIN_COOKIE)) {
      const url = new URL('/admin/login', request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === '/login' || pathname === '/register') {
    if (request.cookies.has(PARTICIPANT_COOKIE)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/register', '/dashboard/:path*', '/entries/:path*'],
};
