'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUserAuth } from '@/hooks/use-user-auth'
import { useLineAuth } from '@/hooks/use-line-auth'
import { Loader2 } from 'lucide-react'

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isRegistrationPage = pathname === '/registration'
  const { isAuthenticated, isLoading: authLoading, needsRegistration, lineProfile } = useUserAuth({
    skipAutoCheck: isRegistrationPage
  })
  const { isLoading: lineLoading, isLoggedIn } = useLineAuth()

  // 本地開發環境跳過條件
  const shouldSkipLiffLocal = (
    process.env.NEXT_PUBLIC_SKIP_LIFF_LOCAL === 'true' ||
    (!process.env.NEXT_PUBLIC_LIFF_ID && (process.env.NODE_ENV !== 'production'))
  )

  useEffect(() => {
    if (isRegistrationPage) return

    if (!lineLoading && !authLoading) {
      // 在本地開發環境中，只要有 lineProfile?.userId 就允許進入
      if (shouldSkipLiffLocal) {
        if (!lineProfile?.userId) {
          router.replace('/registration')
        }
        return
      }

      // 伺服器環境：檢查是否需要註冊，但允許已登入用戶進入
      if (!lineProfile?.userId) {
        router.replace('/registration')
        return
      }

      // 如果用戶已登入但需要註冊，重定向到註冊頁面
      if (needsRegistration) {
        router.replace('/registration')
        return
      }
    }
  }, [isRegistrationPage, lineLoading, authLoading, isLoggedIn, needsRegistration, isAuthenticated, lineProfile?.userId, router, shouldSkipLiffLocal])

  if (isRegistrationPage) {
    return <>{children}</>
  }

  // 在本地開發環境中，只要有 lineProfile?.userId 就允許進入
  if (shouldSkipLiffLocal) {
    if (!lineLoading && !authLoading && lineProfile?.userId) {
      return <>{children}</>
    }
  } else {
    // 伺服器環境：只要有 lineProfile?.userId 且不需要註冊就允許進入
    if (!lineLoading && !authLoading && lineProfile?.userId && !needsRegistration) {
      return <>{children}</>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        <p className="text-gray-600">正在驗證您的使用資格，請稍候…</p>
      </div>
    </div>
  )
}