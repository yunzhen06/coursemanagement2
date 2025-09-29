'use client'

import { useEffect, useMemo, useRef } from 'react'
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
import { CheckCircle, Loader2 } from 'lucide-react'
import { closeLiffWindow } from '@/lib/line-liff'
// import { Button } from '@/components/ui/button'

export default function RegistrationPage() {
  const router = useRouter()
  const { isLoggedIn, isLoading: lineLoading, login, getDevInfo } = useLineAuth()
  const devInfo = getDevInfo()
  const skipLiff = !!devInfo?.skipLiff
  const { authorize: authorizeGoogle, isLoading: googleLoading } = useGoogleAuth()
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
    completeRegistrationWithEmail,
    canProceedToNext,
    lineUser
  } = useRegistrationFlow()

  // 不再自動重定向，讓註冊頁面處理 LINE 登入流程

  // 已註冊使用者導向守衛：若已綁定則離開註冊頁
  const uidMemo = useMemo(() => {
    const uid = lineUser?.userId || ApiService.getLineUserId() || ApiService.bootstrapLineUserId()
    return uid || ''
  }, [lineUser?.userId])

  const didCheckRef = useRef(false)

  useEffect(() => {
    const checkRegistered = async () => {
      try {
        const uid = uidMemo
        if (!uid) return
        // 確保後續 API 請求帶入正確的 LINE 使用者 ID
        try { ApiService.setLineUserId(uid) } catch {}
        const registered = await UserService.getOnboardStatus(uid)
        if (registered) {
          router.replace('/line')
        }
      } catch (e) {
        // 忽略錯誤，保持在註冊頁
      }
    }
    // 僅在 LINE 使用者 ID 改變時檢查；避免嚴格模式造成的重複執行
    didCheckRef.current = false
    if (!didCheckRef.current) {
      didCheckRef.current = true
      checkRegistered()
    }
  }, [uidMemo])

  // Google 授權處理
  const handleGoogleAuth = async () => {
    try {
      // 將使用者選擇的 role 與 name 一併傳入，以便在 LIFF 環境優先使用預註冊流程
      const userEmail = await authorizeGoogle({
        role: data.role ?? undefined,
        name: data.name || ''
      })
      if (userEmail) {
        // 同步保存 lineUserId（來自授權成功訊息或先前儲存）
        const effectiveId = ApiService.getLineUserId() || ApiService.bootstrapLineUserId()
        updateData({ googleEmail: userEmail, lineUserId: effectiveId })
        // Google 授權成功後自動完成註冊
        const success = await completeRegistrationWithEmail(userEmail)
        if (success) {
          // 顯示註冊完成頁面，稍後自動關閉/導向
        }
      }
    } catch (error) {
      console.error('Google 授權失敗:', error)
      // 錯誤處理已在 useGoogleAuth 中處理
    }
  }

  const handleComplete = async () => {
    const success = await completeRegistration()
    if (success) {
      // 註冊成功後保留在完成頁，提示使用 LINE Bot
      // 不自動跳轉到主頁面
    }
  }

  // 載入中狀態
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



  // 註冊完成頁面
  if (isCompleted) {
    // 顯示成功訊息後，數秒自動關閉（在 LINE 內）或導向 LINE 主頁
    useEffect(() => {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          // 若在 LINE 內，關閉 LIFF 視窗；否則導向到 /line
          try {
            closeLiffWindow()
          } catch {}
          router.replace('/line')
        }
      }, 3000)
      return () => clearTimeout(timer)
    }, [])

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                🎉 註冊完成！
              </h1>
              <p className="text-gray-600">
                歡迎使用我們的智能課程管理系統（3 秒後自動關閉/導向）
              </p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <p className="font-semibold text-gray-900">註冊資訊</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">姓名：</span>{data.name}</p>
                  <p><span className="font-medium">身分：</span>{data.role === 'teacher' ? '🎓 教師' : '📚 學生'}</p>
                  <p><span className="font-medium">Google 帳號：</span>{data.googleEmail}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✅</span>
                    <span className="text-sm text-green-800 font-medium">帳號綁定完成</span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    歡迎訊息已發送到您的 LINE，所有功能已啟用！
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">
              註冊完成，您已可在 LINE Bot 使用功能
            </p>
            <p className="text-xs text-gray-400">
              📱 請查看 LINE 訊息獲取功能選單
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 錯誤狀態
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

  // 如果 LINE 未登入，顯示說明（在本地可能已跳過授權）
  // 本地略過 LIFF 時，不阻擋註冊流程，讓使用者可直接選擇身分
  if (!isLoggedIn && !lineLoading && !skipLiff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">歡迎使用課程管理系統</h1>
                {skipLiff ? (
                  <p className="text-gray-600">本地開發模式：已略過 LINE 授權</p>
                ) : (
                  <p className="text-gray-600">正在前往 LINE 授權頁面</p>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-blue-600">📱</span>
                    <span className="text-sm font-medium text-blue-800">LINE 登入授權</span>
                  </div>
                  {skipLiff ? (
                    <p className="text-xs text-blue-700">
                      您目前在本地環境，系統不會進行 LINE 授權。可直接進行註冊或以訪客模式測試功能。
                    </p>
                  ) : (
                    <p className="text-xs text-blue-700">
                      系統會自動為您導向 LINE 登入授權。若未自動跳轉，請從 LINE 內再次開啟此頁，或重新整理。
                    </p>
                  )}
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>授權後您可以：</p>
                  <ul className="mt-2 space-y-1 text-left">
                    <li>• 接收課程提醒通知</li>
                    <li>• 使用 LINE Bot 功能選單</li>
                    <li>• 同步 Google Classroom</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {skipLiff ? (
                  <span className="text-sm">本地環境：未進行 LINE 授權</span>
                ) : (
                  <span className="text-sm">等待導向至 LINE 授權...</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // 如果 LINE 正在載入，顯示載入狀態
  if (lineLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">正在連接 LINE</h2>
                <p className="text-sm text-gray-600">請稍候...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // 根據當前步驟渲染對應頁面
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
          onGoogleAuth={handleGoogleAuth}
          onPrev={prevStep}
        />
      )

    default:
      return null
  }
}