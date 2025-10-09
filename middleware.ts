import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define routes that don't require authentication
const publicRoutes = ['/login', '/register', '/welcome', '/api/auth/login', '/api/auth/register']

// Define routes that require admin access
const adminRoutes = ['/admin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Get token from cookies or authorization header
  const token = request.cookies.get('accessToken')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '')
  
  console.log('Middleware - pathname:', pathname, 'token:', token ? 'present' : 'missing')

  // If no token and trying to access protected route, redirect to login
  if (!token && !publicRoutes.includes(pathname)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For admin routes, we'll let the client-side protection handle it
  // since we need to decode the JWT to check the role
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}