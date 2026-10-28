import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return response;
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

  const pathname = request.nextUrl.pathname;

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
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
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
          return NextResponse.json(
            { error: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated.' },
            { status: 403 }
          );
        }
        const disabledUrl = new URL('/login', request.url);
        disabledUrl.searchParams.set('error', 'deactivated');
        return NextResponse.redirect(disabledUrl);
      }

      // Mandatory 2FA for Admin (exempt TOTP setup APIs)
      const isTotpAllowed =
        pathname.startsWith('/auth/setup-2fa') ||
        pathname.startsWith('/api/v1/auth/totp');

      if (profile.org_role === 'Admin' && !profile.is_totp_enabled && !isTotpAllowed) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: '2FA_REQUIRED', message: 'Two-factor authentication setup is mandatory for Administrators.' },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/auth/setup-2fa', request.url));
      }

      if (pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return response;
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
