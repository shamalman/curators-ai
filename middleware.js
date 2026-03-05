import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  try {
    const res = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    const path = req.nextUrl.pathname;

    // Public routes — no auth required
    const publicRoutes = ['/login', '/signup', '/onboarding', '/onboarding/welcome', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.includes(path);
    const isApiRoute = path.startsWith('/api');

    // Visitor routes — always public (e.g. /shamal, /shamal/ask, /shamal/some-rec)
    // These are any /[handle] paths that aren't known curator-only routes
    const curatorOnlyPaths = ['/myai', '/profile', '/recommendations', '/settings', '/subs', '/invite'];
    const isVisitorRoute = !curatorOnlyPaths.some(p => path === p || path.startsWith(p + '/'))
      && !isPublicRoute && !isApiRoute && path !== '/';

    // Allow public routes, API routes, and visitor routes
    if (isPublicRoute || isApiRoute || isVisitorRoute) {
      // If logged in and visiting /login or /signup, redirect to /myai
      if (session && (path === '/login' || path === '/signup')) {
        return NextResponse.redirect(new URL('/myai', req.url));
      }
      return res;
    }

    // Protected routes — require auth
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    return res;
  } catch (err) {
    // Never crash — fall through and allow the request
    console.error('Middleware error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
