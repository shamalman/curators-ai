import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Public routes — no auth required
  const publicRoutes = ['/login', '/signup', '/onboarding', '/onboarding/welcome'];
  const isPublicRoute = publicRoutes.includes(path);
  const isVisitorRoute = /^\/[a-z0-9-]+/.test(path) && !path.startsWith('/myai') && !path.startsWith('/recommendations') && !publicRoutes.includes(path);
  const isApiRoute = path.startsWith('/api');

  // Allow public routes, visitor routes, and API routes
  if (isPublicRoute || isVisitorRoute || isApiRoute) {
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
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
