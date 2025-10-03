'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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

const SS_KEYS = {
  AWAIT_GOOGLE: 'REG_AWAIT_GOOGLE',
  GOOGLE_DONE: 'GOOGLE_AUTH_DONE',
  LINE_UID: 'LINE_UID',
} as const

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

  const [registrationStatus, setRegistrationStatus] =
    useState<'checking' | 'not_registered' | 'error'>('checking')

  // 避免同一 UID 重複判斷被擋到（可用 force 重新檢查）
  const lastCheckedUidRef = useRef<string>('')

  // 取得候選的真實 UID（含 sessionStorage 備援）
  const uidMemo = useMemo(() => {
    const fromHook = lineUser?.userId
    const fromApi = ApiService.getLineUserId()
    const fromSS = typeof window !== 'undefined' ? sessionStorage.getItem(SS_KEYS.LINE_UID) || '' : ''
    const uid = fromHook || fromApi || fromSS || ''
    if (uid && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(SS_KEYS.LINE_UID, uid)
      } catch {}
    }
    return uid
  }, [lineUser?.userId])

  // 抽出「查核是否已綁定」的可重用函式
  const checkRegistration = useCallback(
    async (opts?: { force?: boolean }) => {
      const { force } = opts || {}
      const uid = uidMemo

      if (!uid) {
        // 外部瀏覽器尚未有 UID：讓使用者可先填表
        if (!isLiffEnvironment()) setRegistrationStatus('not_registered')
        return
      }

      if (!force && lastCheckedUidRef.current === uid) return
      lastCheckedUidRef.current = uid

      setRegistrationStatus('checking')
      try {
        try {
          ApiService.setLineUserId(uid)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(SS_KEYS.LINE_UID, uid)
          }
        } catch {}

        const registered = await UserService.getOnboardStatus(uid)
        if (registered) {
          // 已完成，直接離開註冊頁
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SS_KEYS.AWAIT_GOOGLE)
            sessionStorage.removeItem(SS_KEYS.GOOGLE_DONE)
          }
          if (isLiffEnvironment()) {
            closeLiffWindow()
          } else {
            router.replace('/')
          }
          return
        }
        setRegistrationStatus('not_registered')
      } catch (e) {
        console.error('檢查註冊狀態失敗:', e)
        setRegistrationStatus('not_registered')
      }
    },
    [uidMemo, router]
  )

  // 首次進入或 UID 變更時檢查
  useEffect(() => {
    checkRegistration()
  }, [checkRegistration])

  // 僅在 LIFF 內且未登入才自動觸發 LINE 登入
  useEffect(() => {
    if (lineLoading) return
    if (!isLoggedIn) {
      if (isLiffEnvironment()) {
        try {
          login()
        } catch (e) {
          console.error('啟動 LINE 登入失敗，導向首頁備援:', e)
          router.replace('/')
        }
      } else {
        if (registrationStatus === 'checking') setRegistrationStatus('not_registered')
      }
    }
  }, [lineLoading, isLoggedIn, login, router, registrationStatus])

  // 🔁 關鍵：當「回到此分頁」或「跨分頁 storage 變更」時，強制重新查核是否已綁定
  useEffect(() => {
    const onFocus = () => {
      // 若剛做完 Google（另一分頁），回到此分頁時會觸發
      lastCheckedUidRef.current = '' // 允許再次查核
      checkRegistration({ force: true })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastCheckedUidRef.current = ''
        checkRegistration({ force: true })
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (e.key === SS_KEYS.GOOGLE_DONE || e.key === SS_KEYS.LINE_UID) {
        lastCheckedUidRef.current = ''
        checkRegistration({ force: true })
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('storage', onStorage)
    }
  }, [checkRegistration])

  // Google 授權流程
  const handleGoogleAuth = async () => {
    try {
      const role = data.role ?? undefined
      const name = data.name || ''

      // 標記「期待回來後自動檢查」
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(SS_KEYS.AWAIT_GOOGLE, '1')
          if (uidMemo) sessionStorage.setItem(SS_KEYS.LINE_UID, uidMemo)
        } catch {}
      }

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

      // 在 LIFF：外部瀏覽器開啟；非 LIFF：整頁導向
      if (typeof window !== 'undefined' && (window as any).liff?.openWindow) {
        ;(window as any).liff.openWindow({ url: redirectUrl, external: true })
      } else {
        window.location.href = redirectUrl
      }

      console.log('已開啟 Google 授權，完成後回到本分頁將自動檢查狀態')
    } catch (error) {
      console.error('Google 授權失敗:', error)
    }
  }

  const handleComplete = async () => {
    const success = await completeRegistration()
    if (success) {
      try {
        if (isLiffEnvironment()) {
          closeLiffWindow()
        } else {
          router.replace('/')
        }
      } catch (e) {
        console.error('註冊完成跳轉失敗，使用備援至首頁:', e)
        router.replace('/')
      }
    }
  }

  // ===== UI 狀態 =====
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
      if (isLiffEnvironment()) {
        closeLiffWindow()
      } else {
        router.replace('/')
      }
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

  // 外部瀏覽器、或 LIFF 尚未登入時的提示（但不阻擋流程）
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
                <p className="mt-1">完成 Google 授權後，回到此分頁即可自動檢查並前往首頁。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // 確認未註冊 → 顯示註冊流程
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
