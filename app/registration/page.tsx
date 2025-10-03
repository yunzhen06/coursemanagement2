'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRegistrationFlow } from '@/hooks/use-registration-flow'
import { ApiService } from '@/services/apiService'
import { UserService } from '@/services/userService'
import { useLineAuth } from '@/hooks/use-line-auth'
import { useGoogleAuth } from '@/hooks/use-google-auth'
import { RegistrationRoleSelection } from '@/components/registration-role-selection'
import { RegistrationNameInput } from '@/components/registration-name-input'
import { RegistrationGoogleAuth } from '@/components/registration-google-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { closeLiffWindow, getIdToken } from '@/lib/line-liff'
import { isLiffEnvironment } from '@/lib/liff-environment'
import { Button } from '@/components/ui/button'

const REG_STEP_KEY = 'REG_CURRENT_STEP'
const GOOGLE_AUTH_RESULT_KEY = 'GOOGLE_AUTH_RESULT'

export default function RegistrationPage() {
  const router = useRouter()
  const { isLoggedIn, isLoading: lineLoading, login } = useLineAuth()
  const { isLoading: googleLoading } = useGoogleAuth()
  const {
    currentStep,
    data,
    isCompleted,
    isLoading,
    error,
    updateData,
    nextStep,
    prevStep,
    completeRegistration,
    canProceedToNext,
    lineUser
  } = useRegistrationFlow()

  const [registrationStatus, setRegistrationStatus] = useState<'checking' | 'not_registered' | 'error'>('checking')
  const lastCheckedUidRef = useRef<string>('')

  // 讀取/寫入目前步驟，避免刷新又回第一步
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(REG_STEP_KEY)
      if (saved) {
        const n = Number(saved)
        if (Number.isInteger(n) && n >= 1 && n <= 3 && n !== currentStep) {
          // 用最小副作用的方式前進到指定步驟
          // 只在需要時才連續呼叫 nextStep
          const diff = n - currentStep
          if (diff > 0) {
            for (let i = 0; i < diff; i++) nextStep()
          }
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(REG_STEP_KEY, String(currentStep)) } catch {}
  }, [currentStep])

  // 只接受真正的 LINE userId（不再產假 ID）
  const uidMemo = useMemo(() => {
    return lineUser?.userId || ApiService.getLineUserId() || ''
  }, [lineUser?.userId])

  // 檢查是否已註冊
  useEffect(() => {
    const checkRegistration = async () => {
      if (!uidMemo) {
        if (!isLiffEnvironment()) setRegistrationStatus('not_registered')
        return
      }
      if (lastCheckedUidRef.current === uidMemo) return
      lastCheckedUidRef.current = uidMemo

      setRegistrationStatus('checking')
      try {
        ApiService.setLineUserId(uidMemo)
        const registered = await UserService.getOnboardStatus(uidMemo)
        if (registered) {
          if (isLiffEnvironment()) closeLiffWindow()
          else router.replace('/')
          return
        }
        setRegistrationStatus('not_registered')
      } catch (e) {
        console.error('檢查註冊狀態失敗:', e)
        setRegistrationStatus('not_registered')
      }
    }
    checkRegistration()
  }, [uidMemo, router])

  // 僅在 LIFF 內，且未登入才觸發 LINE 授權；外部瀏覽器不阻擋流程
  useEffect(() => {
    if (lineLoading) return
    if (!isLoggedIn) {
      if (isLiffEnvironment()) {
        try { login() } catch { router.replace('/') }
      } else {
        if (registrationStatus === 'checking') setRegistrationStatus('not_registered')
      }
    }
  }, [lineLoading, isLoggedIn, login, router, registrationStatus])

  // 🔑 監聽 Google Callback 回傳（postMessage + localStorage 備援）
  useEffect(() => {
    const handleMessage = async (evt: MessageEvent) => {
      try {
        if (!evt || !evt.data || evt.origin !== window.location.origin) return
        if (evt.data?.type !== 'GOOGLE_AUTH_RESULT') return
        const { lineUserId, email, registered } = evt.data.payload || {}
        await handleGoogleAuthResult(lineUserId, email, registered)
      } catch (e) {
        console.error('處理 postMessage 失敗:', e)
      }
    }

    const handleStorage = async (evt: StorageEvent) => {
      try {
        if (evt.key !== GOOGLE_AUTH_RESULT_KEY || !evt.newValue) return
        const parsed = JSON.parse(evt.newValue)
        const { lineUserId, email, registered } = parsed || {}
        await handleGoogleAuthResult(lineUserId, email, registered)
      } catch (e) {
        console.error('處理 storage 事件失敗:', e)
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('storage', handleStorage)

    // 若 callback 分頁寫入得很快，這裡也嘗試讀一次 localStorage
    try {
      const cached = localStorage.getItem(GOOGLE_AUTH_RESULT_KEY)
      if (cached) {
        const { lineUserId, email, registered } = JSON.parse(cached)
        handleGoogleAuthResult(lineUserId, email, registered)
      }
    } catch {}

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('storage', handleStorage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 將 callback 結果套用到當前頁（設定 lineUserId → 前進 → 輪詢註冊狀態）
  const handleGoogleAuthResult = async (lineUserId?: string, email?: string, registered?: boolean) => {
    try {
      if (lineUserId) {
        ApiService.setLineUserId(lineUserId)
        updateData({ lineUserId })
      }
      if (email) {
        updateData({ googleEmail: email })
      }

      // 使用者已經完成（後端已寫 token）
      if (registered) {
        try { sessionStorage.removeItem(REG_STEP_KEY) } catch {}
        router.replace('/')
        return
      }

      // 尚未標示完成 → 啟動一次性短輪詢（最多 8 次 / 12 秒）
      let tries = 0
      const timer = setInterval(async () => {
        tries += 1
        try {
          const uid = lineUserId || ApiService.getLineUserId()
          if (!uid) return
          const ok = await UserService.getOnboardStatus(uid)
          if (ok) {
            clearInterval(timer)
            try { sessionStorage.removeItem(REG_STEP_KEY) } catch {}
            router.replace('/')
          } else {
            // 讓畫面停在第 3 步顯示「已開啟 Google 授權…」
            if (currentStep < 3) nextStep()
          }
        } catch {}
        if (tries >= 8) clearInterval(timer)
      }, 1500)
    } catch (e) {
      console.error('套用 Google 回傳結果失敗:', e)
    }
  }

  // Google 授權（維持你原本的寫法）
  const handleGoogleAuth = async () => {
    try {
      const role = data.role ?? undefined
      const name = data.name || ''
      let redirectUrl = ''
      if (isLiffEnvironment() && lineUser?.userId && role && name) {
        const idToken = getIdToken()
        const resp = await ApiService.preRegister({
          id_token: idToken || '',
          role: role!,
          name: name!
        })
        const d: any = resp?.data || resp || {}
        redirectUrl = d.redirectUrl || d.auth_url || d.url || ''
      }
      if (!redirectUrl) {
        const resp = await ApiService.getGoogleOAuthUrl({ role, name })
        const d: any = resp?.data || resp || {}
        redirectUrl = d.redirectUrl || d.auth_url || d.url || ''
      }
      if (!redirectUrl) {
        alert('後端未回傳 redirectUrl')
        return
      }
      if (typeof window !== 'undefined' && (window as any).liff?.openWindow) {
        (window as any).liff.openWindow({ url: redirectUrl, external: true })
      } else {
        // 用新分頁開啟，讓 callback 能 window.opener.postMessage 回來
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')
      }
      // 記住目前在第 3 步（避免刷新退回第一步）
      try { sessionStorage.setItem(REG_STEP_KEY, '3') } catch {}
      console.log('已開啟 Google 授權，請完成後返回應用程式')
    } catch (error) {
      console.error('Google 授權失敗:', error)
    }
  }

  const handleComplete = async () => {
    const success = await completeRegistration()
    if (success) {
      try {
        if (isLiffEnvironment()) closeLiffWindow()
        else router.replace('/')
      } catch {
        router.replace('/')
      }
    }
  }

  // ===== UI 狀態（保持你原本的 UI） =====
  if (lineLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-gray-600">正在初始化...</p>
        </div>
      </div>
    )
  }

  if (registrationStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-gray-600">正在檢查註冊狀態...</p>
        </div>
      </div>
    )
  }

  if (registrationStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">!</span>
              </div>
              <h2 className="text-lg font-semibold text-red-800 mb-2">檢查狀態失敗</h2>
              <p className="text-red-600 text-sm">無法確認註冊狀態，請重新整理頁面</p>
              <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
                重新整理
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    try {
      if (isLiffEnvironment()) closeLiffWindow()
      else router.replace('/')
    } catch {
      router.replace('/')
    }
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">!</span>
              </div>
              <h2 className="text-lg font-semibold text-red-800 mb-2">發生錯誤</h2>
              <p className="text-red-600 text-sm">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!isLoggedIn && !lineLoading && !isLiffEnvironment()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">歡迎使用課程管理系統</h1>
                <p className="text-gray-600">您正在外部瀏覽器中進行註冊。</p>
              </div>
              <div className="text-sm text-gray-500">
                <p>接下來請先選擇身分並輸入姓名，再進行 Google 授權。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (registrationStatus === 'not_registered') {
    switch (currentStep) {
      case 1:
        return (
          <RegistrationRoleSelection
            selectedRole={data.role}
            onRoleSelect={(role) => updateData({ role })}
            onNext={nextStep}
            canProceed={canProceedToNext()}
          />
        )
      case 2:
        return (
          <RegistrationNameInput
            name={data.name}
            role={data.role}
            onNameChange={(name) => updateData({ name })}
            onNext={nextStep}
            onPrev={prevStep}
            canProceed={canProceedToNext()}
          />
        )
      case 3:
        return (
          <RegistrationGoogleAuth
            name={data.name}
            role={data.role}
            googleEmail={data.googleEmail}
            lineUserId={data.lineUserId}
            isLoading={isLoading}
            isGoogleLoading={googleLoading}
            isCompleted={isCompleted}
            onGoogleAuth={handleGoogleAuth}
            onPrev={prevStep}
          />
        )
      default:
        return null
    }
  }

  return null
}
