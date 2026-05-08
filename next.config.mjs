/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from bundling these packages for server-side code.
  // pg and Prisma adapter-pg use native Node.js bindings that break when bundled.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
