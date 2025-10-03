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
  const { isLoading: authLoading, needsRegistration, lineProfile } = useUserAuth({
    skipAutoCheck: isRegistrationPage
  })
  const { isLoading: lineLoading, isLoggedIn } = useLineAuth()

  useEffect(() => {
    if (isRegistrationPage) return

    if (lineLoading || authLoading) return

    // 沒有登入 LINE 視為需註冊
    if (!isLoggedIn) {
      router.replace('/registration')
      return
    }

    if (needsRegistration) {
      router.replace('/registration')
    }
  }, [isRegistrationPage, lineLoading, authLoading, isLoggedIn, needsRegistration, lineProfile?.userId, router])

  if (isRegistrationPage) {
    return <>{children}</>
  }

  if (!lineLoading && !authLoading && isLoggedIn && !needsRegistration) {
    return <>{children}</>
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
