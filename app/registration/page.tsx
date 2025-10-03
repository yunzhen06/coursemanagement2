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

const STORAGE_KEY = 'reg_flow_v1'

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
  const lastCheckedUidRef = useRef<string>('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 只接受真實的 LINE userId 或已在 ApiService 設定的 id
  const uidMemo = useMemo(() => {
    return lineUser?.userId || ApiService.getLineUserId() || ''
  }, [lineUser?.userId])

  // ---------- 1) 復原：從 sessionStorage 還原步驟與表單 ----------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      // 若尚未登入 LIFF，但有舊的草稿，就先還原畫面（讓使用者不會回到第一步）
      if (parsed?.step && typeof parsed.step === 'number') {
        // 僅在目前還在第一步時才強制往後（避免覆蓋使用中的狀態）
        // 這邊不直接呼叫 hook 的 setState，所以用 nextStep/prevStep 模擬移動
        const targetStep = Math.max(1, Math.min(3, parsed.step))
        // 還原資料
        if (parsed?.data) {
          updateData({
            role: parsed.data.role ?? null,
            name: parsed.data.name ?? '',
            googleEmail: parsed.data.googleEmail ?? '',
            lineUserId: parsed.data.lineUserId ?? ''
          })
        }
        // 將步驟移動到儲存的位置
        // currentStep 只能透過 next/prev 來改，這裡做最少次數移動
        const diff = targetStep - (currentStep || 1)
        if (diff > 0) {
          for (let i = 0; i < diff; i++) nextStep()
        } else if (diff < 0) {
          for (let i = 0; i < Math.abs(diff); i++) prevStep()
        }
      }
    } catch {}
    // 只在初始執行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 2) 持續保存：任何步驟/資料變更都暫存 ----------
  useEffect(() => {
    try {
      const snapshot = {
        step: currentStep,
        data
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {}
  }, [currentStep, data])

  // ---------- 3) 檢查是否已註冊（頁面進來與 uid 變更時） ----------
  useEffect(() => {
    const checkRegistration = async () => {
      if (!uidMemo) {
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
        setRegistrationStatus('not_registered')
      }
    }

    checkRegistration()
  }, [uidMemo, router])

  // ---------- 4) 只在 LIFF 內且未登入時觸發 LINE 授權 ----------
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
        if (registrationStatus === 'checking') {
          setRegistrationStatus('not_registered')
        }
      }
    }
  }, [lineLoading, isLoggedIn, login, router, registrationStatus])

  // ---------- 5) 第 3 步「自動偵測授權完成」：輪詢＋視窗回到焦點即刻檢查 ----------
  useEffect(() => {
    const canPoll = registrationStatus === 'not_registered' && currentStep === 3 && !!uidMemo
    if (!canPoll) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    let cooling = false
    const checkOnce = async () => {
      if (cooling) return
      cooling = true
      try {
        const ok = await UserService.getOnboardStatus(uidMemo)
        if (ok) {
          // 清除暫存，避免下次又回到註冊
          try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
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
        }
      } finally {
        // 1.5s 冷卻避免太頻繁
        setTimeout(() => { cooling = false }, 1500)
      }
    }

    // 啟動輪詢（每 2.5s）
    pollTimerRef.current = setInterval(checkOnce, 2500)
    // 視窗回到焦點時，立即檢查一次
    const onFocus = () => { checkOnce() }
    window.addEventListener('focus', onFocus)

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      window.removeEventListener('focus', onFocus)
    }
  }, [registrationStatus, currentStep, uidMemo, router])

  // ---------- 6) Google 授權 ----------
  const handleGoogleAuth = async () => {
    try {
      const role = data.role ?? undefined
      const name = data.name || ''

      // 先把當前步驟與資料寫入 sessionStorage，回來不會掉步驟
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ step: 3, data })
        )
      } catch {}

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
        ;(window as any).liff.openWindow({ url: redirectUrl, external: true })
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
        // 完成後清掉暫存
        try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
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
      // 完成後清掉暫存
      try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
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
