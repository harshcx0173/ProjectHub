import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/security/rate-limiter';

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; media-src 'self' blob: https:; object-src 'none'; frame-ancestors 'none';"
  );
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return res;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CSRF Protection for state-changing API requests
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return applySecurityHeaders(
            NextResponse.json(
              { error: 'FORBIDDEN', message: 'Cross-origin request rejected (CSRF protection).' },
              { status: 403 }
            )
          );
        }
      } catch {
        return applySecurityHeaders(
          NextResponse.json(
            { error: 'FORBIDDEN', message: 'Invalid origin header.' },
            { status: 403 }
          )
        );
      }
    }
  }

  // Rate Limiting for sensitive endpoints (Auth, Invitations, Password)
  if (pathname.startsWith('/api/v1/auth/') || pathname.startsWith('/api/v1/invitations')) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? (forwarded.split(',')[0] || '').trim() || '127.0.0.1' : '127.0.0.1';
    const rateLimit = await checkRateLimit(`ip:${ip}:${pathname}`, { limit: 30, windowSeconds: 60 });
    if (!rateLimit.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.reset),
            },
          }
        )
      );
    }
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return applySecurityHeaders(response);
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
          })
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths allowed without authentication
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/auth/forgot-password') ||
    pathname.startsWith('/auth/reset-password') ||
    pathname.startsWith('/api/v1/invitations') ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico');

  if (!user && !isPublicPath) {
    if (pathname.startsWith('/api/')) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Authentication required' },
          { status: 401 }
        )
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (user) {
    // Check user profile status
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, org_role, is_totp_enabled')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      if (profile.status === 'disabled') {
        await supabase.auth.signOut();
        if (pathname.startsWith('/api/')) {
          return applySecurityHeaders(
            NextResponse.json(
              { error: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated.' },
              { status: 403 }
            )
          );
        }
        const disabledUrl = new URL('/login', request.url);
        disabledUrl.searchParams.set('error', 'deactivated');
        return applySecurityHeaders(NextResponse.redirect(disabledUrl));
      }

      // Mandatory 2FA for Admin (exempt TOTP setup APIs)
      const isTotpAllowed =
        pathname.startsWith('/auth/setup-2fa') ||
        pathname.startsWith('/api/v1/auth/totp');

      if (profile.org_role === 'Admin' && !profile.is_totp_enabled && !isTotpAllowed) {
        if (pathname.startsWith('/api/')) {
          return applySecurityHeaders(
            NextResponse.json(
              { error: '2FA_REQUIRED', message: 'Two-factor authentication setup is mandatory for Administrators.' },
              { status: 403 }
            )
          );
        }
        return applySecurityHeaders(NextResponse.redirect(new URL('/auth/setup-2fa', request.url)));
      }

      if (pathname === '/login') {
        return applySecurityHeaders(NextResponse.redirect(new URL('/', request.url)));
      }
    }
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
