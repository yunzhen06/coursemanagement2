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
    return [
      // 代理 API，確保尾斜線保留
      { source: '/_api/v2/:path*/', destination: 'http://localhost:8000/api/v2/:path*/' },
      { source: '/_api/v2/:path*', destination: 'http://localhost:8000/api/v2/:path*/' },
      // 備援：舊路徑
      { source: '/api/v2/:path*/', destination: 'http://localhost:8000/api/v2/:path*/' },
      { source: '/api/v2/:path*', destination: 'http://localhost:8000/api/v2/:path*/' },
      // 媒體檔案
      { source: '/media/:path*', destination: 'http://localhost:8000/media/:path*' },
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
