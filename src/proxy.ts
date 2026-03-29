export { default as proxy } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/',
    '/buyers/:path*',
    '/appointments/:path*',
    '/products/:path*',
    '/sales/:path*',
  ],
}
