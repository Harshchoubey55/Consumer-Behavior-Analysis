/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.unsplash.com' },
    ],
  },
  // Ensure Prisma can access the db file at build time
  outputFileTracingIncludes: {
    '/api/*': ['./prisma/**/*'],
  },
};

module.exports = nextConfig;
