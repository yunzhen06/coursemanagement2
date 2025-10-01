"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GoogleIcon, AlertTriangleIcon, CheckIcon } from "@/components/icons"
import { ApiService } from "@/services/apiService"

interface GoogleAuthProps {
  onAuthSuccess?: () => void
  onAuthError?: (error: string) => void
}

export function GoogleAuth({ onAuthSuccess, onAuthError }: GoogleAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 從後端獲取 Google OAuth URL
      const resp = await ApiService.getGoogleOAuthUrl()
      if (resp.error) {
        throw new Error(resp.error)
      }
      const data: any = resp.data || {}
      const redirectUrl = data.redirectUrl || data.auth_url || ''
      if (!redirectUrl || typeof redirectUrl !== 'string') {
        throw new Error('未取得授權連結')
      }
      
      // 在新視窗中打開 Google 授權頁面
      const authWindow = window.open(
        redirectUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )

      // 監聽來自授權頁面的 postMessage
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return
        }

        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage)
          authWindow?.close()
          // 儲存 line_user_id，以支援非 LIFF 環境
          try {
            const incomingId = (event.data as any)?.line_user_id
            if (typeof incomingId === 'string' && incomingId.trim()) {
              ApiService.setLineUserId(incomingId)
              if (typeof window !== 'undefined') {
                localStorage.setItem('lineUserId', incomingId)
              }
            }
          } catch {}
          setIsAuthorized(true)
          setIsLoading(false)
          onAuthSuccess?.()
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          window.removeEventListener('message', handleMessage)
          authWindow?.close()
          setError('授權失敗')
          setIsLoading(false)
          onAuthError?.('授權失敗')
        }
      }

      window.addEventListener('message', handleMessage)

      // 備用方案：定期檢查視窗是否關閉
      const checkWindowClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkWindowClosed)
          window.removeEventListener('message', handleMessage)
          
          // 檢查授權狀態
          setTimeout(async () => {
            try {
              const response = await ApiService.testGoogleConnection()
              if (response.data && (response.data as any).is_connected) {
                setIsAuthorized(true)
                onAuthSuccess?.()
              } else {
                setError('授權未完成或失敗')
                onAuthError?.('授權未完成或失敗')
              }
            } catch (error) {
              setError('檢查授權狀態失敗')
              onAuthError?.('檢查授權狀態失敗')
            }
            setIsLoading(false)
          }, 1000)
        }
      }, 1000)

      // 10分鐘後自動停止檢查
      setTimeout(() => {
        clearInterval(checkWindowClosed)
        window.removeEventListener('message', handleMessage)
        if (authWindow && !authWindow.closed) {
          authWindow.close()
        }
        setIsLoading(false)
      }, 600000)
    } catch (error) {
      console.error('Google 授權失敗:', error)
      setError('授權過程中發生錯誤')
      onAuthError?.('授權過程中發生錯誤')
      setIsLoading(false)
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <GoogleIcon className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">Google Classroom 授權</h3>
            <p className="text-sm text-muted-foreground">
              連接您的 Google Classroom 帳戶以同步課程和作業
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isAuthorized && (
          <Alert>
            <CheckIcon className="h-4 w-4" />
            <AlertDescription>
              ✅ Google Classroom 已成功授權！您現在可以同步課程和作業了。
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button 
            onClick={handleGoogleAuth} 
            disabled={isLoading || isAuthorized}
            className="w-full gap-2"
          >
            <GoogleIcon className="w-4 h-4" />
            {isLoading ? '正在授權...' : isAuthorized ? '已授權' : '連接 Google Classroom'}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 授權後可以同步 Google Classroom 中的課程和作業</p>
            <p>• 我們只會讀取您的課程資訊，不會修改任何內容</p>
            <p>• 您可以隨時在 Google 帳戶設定中撤銷授權</p>
          </div>
        </div>
      </div>
    </Card>
  )
}