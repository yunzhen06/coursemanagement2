/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiBaseUrl = process.env.BACKEND_API_URL || 'http://localhost:8000'
    
    return [
      // 代理 API，確保尾斜線保留
      { source: '/_api/v2/:path*/', destination: `${apiBaseUrl}/api/v2/:path*/` },
      { source: '/_api/v2/:path*', destination: `${apiBaseUrl}/api/v2/:path*/` },
      // 備援：舊路徑
      { source: '/api/v2/:path*/', destination: `${apiBaseUrl}/api/v2/:path*/` },
      { source: '/api/v2/:path*', destination: `${apiBaseUrl}/api/v2/:path*/` },
      // OAuth Google URL 路由
      { source: '/api/oauth/:path*/', destination: `${apiBaseUrl}/api/oauth/:path*/` },
      { source: '/api/oauth/:path*', destination: `${apiBaseUrl}/api/oauth/:path*/` },
      // Onboard（預註冊）與 CSRF 路由
      { source: '/api/onboard/:path*/', destination: `${apiBaseUrl}/api/onboard/:path*/` },
      { source: '/api/onboard/:path*', destination: `${apiBaseUrl}/api/onboard/:path*/` },
      { source: '/api/csrf/', destination: `${apiBaseUrl}/api/csrf/` },
      { source: '/api/csrf', destination: `${apiBaseUrl}/api/csrf/` },
      // 媒體檔案
      { source: '/media/:path*', destination: `${apiBaseUrl}/media/:path*` },
    ]
  },
  async headers() {
    return [
      {
        source: '/_api/v2/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        ],
      },
      {
        source: '/api/v2/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
