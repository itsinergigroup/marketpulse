/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from bundling these packages for server-side code.
  // pg and Prisma adapter-pg use native Node.js bindings that break when bundled.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
