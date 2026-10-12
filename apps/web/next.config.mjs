/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  
  // Performance optimizations for smoke tests
  experimental: {
    optimizeCss: true, // Enable CSS optimization
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Optimize production builds
  // swcMinify: true, // Deprecated in Next.js 14+, SWC is default
  
  // Note: output: 'standalone' removed - incompatible with custom server.js
  // output: 'standalone',
  
  // Optimize images
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Add cache headers for static assets
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/login',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/api/health',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=5, stale-while-revalidate=10',
          },
        ],
      },
      {
        source: '/api/queue/stats',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=2, stale-while-revalidate=5',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ];
  },
  
  allowedDevOrigins: [
    'localhost',
    '10.59.69.42',
    '192.168.137.1', 
    '192.168.137.80',
    '172.16.105.4', 
    '172.24.32.1', 
    '0.0.0.0',
    '*.local',
    '*.lan',
    'increase-cabinet-indicate-austin.trycloudflare.com',
    '*.trycloudflare.com',
    'oscar-upgrading-shower-soma.trycloudflare.com',
    'joan-theta-creator-amendments.trycloudflare.com',
    'slight-keyboards-tobago-growth.trycloudflare.com',
    'calcium-presentations-delight-signed.trycloudflare.com',
    'reminder-landscape-begun-panels.trycloudflare.com'
  ],
};

export default nextConfig;
