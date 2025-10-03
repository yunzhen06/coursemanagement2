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

  // 狀態管理
  const [registrationStatus, setRegistrationStatus] = useState<'checking' | 'not_registered' | 'error'>('checking')
  // 避免重複以相同 UID 檢查
  const lastCheckedUidRef = useRef<string>('')

  // 只接受「真實」的 LINE userId 或 callback 已保存的 id，不再產生假 ID
  const uidMemo = useMemo(() => {
    return lineUser?.userId || ApiService.getLineUserId() || ''
  }, [lineUser?.userId])

  // 檢查是否已註冊
  useEffect(() => {
    const checkRegistration = async () => {
      if (!uidMemo) {
        // 還沒有拿到真正的 UID，若非 LIFF 環境就直接讓使用者進入註冊表單
        if (!isLiffEnvironment()) {
          setRegistrationStatus('not_registered')
        }
        return
      }

      if (lastCheckedUidRef.current === uidMemo) return
      lastCheckedUidRef.current = uidMemo

      setRegistrationStatus('checking')
      console.log('檢查註冊狀態，LINE User ID:', uidMemo)

      try {
        try { ApiService.setLineUserId(uidMemo) } catch {}

        const registered = await UserService.getOnboardStatus(uidMemo)

        if (registered) {
          console.log('✅ 用戶已註冊，自動跳轉到應用首頁')
          try {
            if (isLiffEnvironment()) {
              closeLiffWindow()
            } else {
              router.replace('/')
            }
          } catch {
            router.replace('/')
          }
          return
        } else {
          console.log('❌ 用戶未註冊，允許進入註冊流程')
          setRegistrationStatus('not_registered')
        }
      } catch (e) {
        console.error('檢查註冊狀態失敗:', e)
        // 檢查失敗也允許進入註冊流程，避免卡住
        setRegistrationStatus('not_registered')
      }
    }

    checkRegistration()
  }, [uidMemo, router])

  // 只在 LIFF 內，且未登入時才觸發 LINE 授權；外部瀏覽器不阻擋註冊流程
  useEffect(() => {
    if (lineLoading) return
    if (!isLoggedIn) {
      if (isLiffEnvironment()) {
        console.log('LIFF 環境且未登入，啟動 LINE 登入流程')
        try {
          login()
        } catch (e) {
          console.error('啟動 LINE 登入失敗，導向首頁備援:', e)
          router.replace('/')
        }
      } else {
        // 外部瀏覽器：讓使用者可直接走註冊表單（例如先填身分/姓名，再做 Google 授權）
        if (registrationStatus === 'checking') {
          setRegistrationStatus('not_registered')
        }
      }
    }
  }, [lineLoading, isLoggedIn, login, router, registrationStatus])

  // Google 授權
  const handleGoogleAuth = async () => {
    try {
      const role = data.role ?? undefined
      const name = data.name || ''

      // LIFF 環境優先使用預註冊，否則直接取得 OAuth 連結
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
        (window as any).liff.openWindow({ url: redirectUrl, external: true })
      } else {
        window.location.href = redirectUrl
      }

      console.log('已開啟 Google 授權，請完成後返回應用程式')
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
