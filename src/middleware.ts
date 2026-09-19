import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /darshan and /ashirwad are standalone pages outside the locale tree — no
  // /en, /mr, /hi prefix, and no next-intl rewrite.
  for (const standalone of ['/darshan', '/ashirwad']) {
    if (pathname === standalone || pathname.startsWith(`${standalone}/`)) {
      return NextResponse.next();
    }
  }

  // /admin sits outside the locale tree and behind HTTP basic auth.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASSWORD;
    if (!user || !pass) {
      return new NextResponse('Admin is not configured (ADMIN_USER / ADMIN_PASSWORD).', {
        status: 503,
      });
    }
    // Same credentials, two transports: the Authorization header (browser
    // prompt) or a `morya_admin` cookie (base64 user:pass — lets curl/
    // automation authenticate without the native dialog).
    const header = req.headers.get('authorization') ?? '';
    const [scheme, headerToken] = header.split(' ');
    const cookieToken = req.cookies.get('morya_admin')?.value;
    for (const encoded of [scheme === 'Basic' ? headerToken : null, cookieToken]) {
      if (!encoded) continue;
      try {
        const decoded = atob(encoded);
        const idx = decoded.indexOf(':');
        if (decoded.slice(0, idx) === user && decoded.slice(idx + 1) === pass) {
          return NextResponse.next();
        }
      } catch {
        // fall through to 401
      }
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Morya Map admin"' },
    });
  }

  return intl(req);
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
