/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
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
    // 在 Vercel 環境下，外部 API 代理不起作用
    // 只保留本地開發環境的代理配置
    console.log('Rewrites function called, NODE_ENV:', process.env.NODE_ENV, 'VERCEL:', process.env.VERCEL)
    
    if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
      const apiBaseUrl = process.env.BACKEND_API_URL || 'http://localhost:8000'
      
      console.log('Next.js rewrites enabled, BACKEND_API_URL:', apiBaseUrl)
      
      const rewrites = [
        // 本地開發環境的 API 代理
        { source: '/api/v2/:path*', destination: `${apiBaseUrl}/api/v2/:path*` },
        { source: '/api/oauth/:path*', destination: `${apiBaseUrl}/api/oauth/:path*` },
        // 支持帶尾隨斜杠的 OAuth URL
        { source: '/api/oauth/:path*/', destination: `${apiBaseUrl}/api/oauth/:path*/` },
        // 媒體檔案
        { source: '/media/:path*', destination: `${apiBaseUrl}/media/:path*` },
      ]
      
      console.log('Rewrites configuration:', JSON.stringify(rewrites, null, 2))
      return rewrites
    }
    
    // 生產環境（Vercel）不使用代理
    console.log('Next.js rewrites disabled (production mode)')
    return []
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
