'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiService } from '@/services/apiService'
import { getCsrfToken, fetchCsrfToken } from '@/lib/csrf-token'
import { getIdToken } from '@/lib/line-liff'
import { useLineAuth } from '@/hooks/use-line-auth'

export function DebugRegistration() {
  const { user: lineUser, isLoggedIn } = useLineAuth()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runDiagnostics = async () => {
    setIsLoading(true)
    const info: any = {
      timestamp: new Date().toISOString(),
      environment: {
        isClient: typeof window !== 'undefined',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
        origin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
        apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'Not set'
      },
      lineAuth: {
        isLoggedIn,
        userId: lineUser?.userId || 'Not available',
        displayName: lineUser?.displayName || 'Not available',
        apiServiceUserId: ApiService.getLineUserId() || 'Not set'
      },
      csrf: {
        currentToken: getCsrfToken() || 'Not found',
        fetchAttempt: null
      },
      liff: {
        idToken: null,
        error: null
      },
      apiTest: {
        preRegisterTest: null,
        error: null
      }
    }

    try {
      // 1. 測試 CSRF token 取得
      const publicApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')
      const csrfUrl = publicApiBase ? `${publicApiBase}/api/csrf/` : '/api/csrf/'
      
      try {
        await fetchCsrfToken(csrfUrl)
        info.csrf.fetchAttempt = {
          success: true,
          url: csrfUrl,
          tokenAfterFetch: getCsrfToken()
        }
      } catch (error) {
        info.csrf.fetchAttempt = {
          success: false,
          url: csrfUrl,
          error: error instanceof Error ? error.message : String(error)
        }
      }

      // 2. 測試 LINE ID token
      try {
        const idToken = getIdToken()
        info.liff.idToken = idToken ? `${idToken.substring(0, 20)}...` : 'Not available'
      } catch (error) {
        info.liff.error = error instanceof Error ? error.message : String(error)
      }

      // 3. 測試 pre_register API（如果有必要資料）
      if (info.liff.idToken && info.lineAuth.userId) {
        try {
          const testResponse = await ApiService.preRegister({
            id_token: getIdToken()!,
            role: 'student',
            name: 'Test User'
          })
          
          info.apiTest.preRegisterTest = {
            success: !testResponse.error,
            response: testResponse.error ? {
              error: testResponse.error,
              details: testResponse.details
            } : 'Success (redirectUrl received)'
          }
        } catch (error) {
          info.apiTest.error = error instanceof Error ? error.message : String(error)
        }
      } else {
        info.apiTest.preRegisterTest = 'Skipped - missing id_token or line_user_id'
      }

    } catch (error) {
      info.generalError = error instanceof Error ? error.message : String(error)
    }

    setDebugInfo(info)
    setIsLoading(false)
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>註冊問題診斷工具</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runDiagnostics} disabled={isLoading}>
          {isLoading ? '診斷中...' : '開始診斷'}
        </Button>

        {debugInfo && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                診斷完成於: {debugInfo.timestamp}
              </AlertDescription>
            </Alert>

            {/* 環境資訊 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">環境資訊</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(debugInfo.environment, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* LINE 授權狀態 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">LINE 授權狀態</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(debugInfo.lineAuth, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* CSRF Token 狀態 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CSRF Token 狀態</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(debugInfo.csrf, null, 2)}
                </pre>
                {!debugInfo.csrf.currentToken && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-red-600">
                      ❌ CSRF Token 缺失 - 這可能是 400 錯誤的原因
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* LIFF ID Token 狀態 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">LIFF ID Token 狀態</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(debugInfo.liff, null, 2)}
                </pre>
                {debugInfo.liff.error && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-red-600">
                      ❌ ID Token 取得失敗 - 這可能是 400 錯誤的原因
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* API 測試結果 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API 測試結果</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(debugInfo.apiTest, null, 2)}
                </pre>
                {debugInfo.apiTest.error && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-red-600">
                      ❌ API 測試失敗: {debugInfo.apiTest.error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 建議解決方案 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">建議解決方案</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!debugInfo.csrf.currentToken && (
                  <Alert>
                    <AlertDescription>
                      🔧 CSRF Token 問題：檢查後端 /api/csrf/ 端點是否正常運作
                    </AlertDescription>
                  </Alert>
                )}
                {debugInfo.liff.error && (
                  <Alert>
                    <AlertDescription>
                      🔧 LIFF 問題：確認是否在 LINE 環境中開啟，或檢查 LIFF ID 設定
                    </AlertDescription>
                  </Alert>
                )}
                {debugInfo.apiTest.preRegisterTest?.response?.error && (
                  <Alert>
                    <AlertDescription>
                      🔧 API 錯誤：{debugInfo.apiTest.preRegisterTest.response.error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}