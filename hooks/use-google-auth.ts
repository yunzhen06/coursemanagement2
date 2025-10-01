'use client'

import { useState, useCallback } from 'react'
import { ApiService } from '@/services/apiService'
import { getIdToken, parseLiffReturn } from '@/lib/line-liff'
import { 
  openGoogleAuthInLiff, 
  setupGoogleAuthMessageListener,
  parseGoogleAuthCallback,
  cleanupOAuthParams,
  isLiffEnvironment
} from '@/lib/liff-environment'
import { useLineAuth } from './use-line-auth'

export interface GoogleAuthState {
  isAuthorized: boolean
  isLoading: boolean
  error: string | null
  userEmail: string | null
}

export function useGoogleAuth() {
  const { user: lineUser, isLoggedIn: isLineLoggedIn } = useLineAuth()
  
  const [state, setState] = useState<GoogleAuthState>({
    isAuthorized: false,
    isLoading: false,
    error: null,
    userEmail: null
  })

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }))
  }

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }

  const setAuthorized = (authorized: boolean, email?: string) => {
    setState(prev => ({ 
      ...prev, 
      isAuthorized: authorized,
      userEmail: email || null
    }))
  }

  const authorize = useCallback(async (payload?: { role?: 'teacher' | 'student'; name?: string }): Promise<string | null> => {
    setLoading(true)
    setError(null)

    try {
      // 確保使用真實的 LINE user ID
      if (isLineLoggedIn && lineUser?.userId) {
        ApiService.setLineUserId(lineUser.userId)
      }
      
      // 1) 如果在 LIFF 且提供 role/name，優先走預註冊流程（需要 id_token + CSRF）
      let resp: any
      const hasRegistrationPayload = !!(payload?.role && payload?.name)
      const canUsePreRegister = isLineLoggedIn && !!lineUser?.userId && hasRegistrationPayload

      if (canUsePreRegister) {
        const idToken = getIdToken()
        if (typeof idToken === 'string' && idToken.trim()) {
          try {
            resp = await ApiService.preRegister({
              id_token: idToken,
              role: payload!.role!,
              name: payload!.name!,
            })
          } catch (e) {
            // 預註冊失敗時，改用直接 OAuth，但仍傳遞用戶數據
            resp = await ApiService.getGoogleOAuthUrl(payload)
          }
        } else {
          // 取不到 id_token 時退回直接 OAuth，但仍傳遞用戶數據
          resp = await ApiService.getGoogleOAuthUrl(payload)
        }
      } else {
        // 2) 其他情況（非 LIFF 或沒有 role/name），走直接 OAuth（csrf_exempt）
        resp = await ApiService.getGoogleOAuthUrl(payload)
      }

      // 若預註冊返回錯誤或未取得連結，嘗試再取一次直接 OAuth 連結
      if (resp?.error) {
        try {
          resp = await ApiService.getGoogleOAuthUrl(payload)
        } catch {}
      }

      // 統一解析可能的欄位名稱：redirectUrl / auth_url / url
      const extractRedirectUrl = (r: any): string => {
        try {
          const d = (r && r.data) ? r.data : r || {}
          const candidate = (d && (d['redirectUrl'] || d['auth_url'] || d['url']))
            || (r && (r['redirectUrl'] || r['auth_url'] || r['url']))
            || ''
          return typeof candidate === 'string' ? candidate : ''
        } catch {
          return ''
        }
      }

      let redirectUrl: string = extractRedirectUrl(resp)
      if (!redirectUrl) {
        try {
          const fallback = await ApiService.getGoogleOAuthUrl()
          redirectUrl = extractRedirectUrl(fallback)
        } catch {}
      }
      if (!redirectUrl) {
        throw new Error('未取得授權連結')
      }

      // 檢查是否已有回調數據（頁面重新載入後）
      const callbackData = parseGoogleAuthCallback()
      if (callbackData.hasCallback) {
        // 清理 URL 參數
        cleanupOAuthParams()
        
        // 儲存用戶數據
        if (callbackData.lineUserId) {
          ApiService.setLineUserId(callbackData.lineUserId)
          if (typeof window !== 'undefined') {
            localStorage.setItem('lineUserId', callbackData.lineUserId)
          }
        }
        
        const userEmail = callbackData.email || 'user@gmail.com'
        setAuthorized(true, userEmail)
        setLoading(false)
        return userEmail
      }

      // 使用適合的方式開啟授權連結
      await openGoogleAuthInLiff(redirectUrl)

      return new Promise((resolve, reject) => {
        // 設置 postMessage 監聽器
        const cleanup = setupGoogleAuthMessageListener(
          (data) => {
            cleanup()
            
            // 儲存 line_user_id 以備之後 API 使用
            if (data.line_user_id) {
              ApiService.setLineUserId(data.line_user_id)
              if (typeof window !== 'undefined') {
                localStorage.setItem('lineUserId', data.line_user_id)
              }
            }
            
            const userEmail = data.email || 'user@gmail.com'
            setAuthorized(true, userEmail)
            setLoading(false)
            resolve(userEmail)
          },
          (error) => {
            cleanup()
            setError(error)
            setLoading(false)
            reject(new Error(error))
          }
        )

        // 備用方案：輪詢檢查授權狀態
        const startedAt = Date.now()
        const poll = setInterval(async () => {
          // 超時 10 分鐘
          if (Date.now() - startedAt > 10 * 60 * 1000) {
            clearInterval(poll)
            cleanup()
            setLoading(false)
            setError('授權超時')
            reject(new Error('授權超時'))
            return
          }

          try {
            // 檢查 URL 參數（LIFF deep link 返回）
            const ret = parseLiffReturn()
            if ((ret.email && ret.email.includes('@')) || ret.lineUserId) {
              clearInterval(poll)
              cleanup()
              
              // 儲存 line_user_id 以備之後 API 使用
              if (ret.lineUserId) {
                ApiService.setLineUserId(ret.lineUserId)
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lineUserId', ret.lineUserId)
                }
              }
              const userEmail = ret.email || 'user@gmail.com'
              setAuthorized(true, userEmail)
              setLoading(false)
              resolve(userEmail)
              return
            }

            // 後端連線測試作為最後備援
            const response = await ApiService.getGoogleApiStatus()
            if (response.data && (response.data as any).is_connected) {
              clearInterval(poll)
              cleanup()
              const userEmail = 'user@gmail.com'
              setAuthorized(true, userEmail)
              setLoading(false)
              resolve(userEmail)
              return
            }
          } catch (e) {
            // 忽略暫時性錯誤，繼續輪詢
          }
        }, 3000) // 降低輪詢頻率到 3 秒
      })
    } catch (error) {
      console.error('Google 授權失敗:', error)
      setError('授權過程中發生錯誤')
      setLoading(false)
      throw error
    }
  }, [isLineLoggedIn, lineUser])

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await ApiService.getGoogleApiStatus()
      if (response.data && (response.data as any).is_connected) {
        setAuthorized(true, 'user@gmail.com') // 模擬 email
        return true
      }
      return false
    } catch (error) {
      console.error('檢查 Google 授權狀態失敗:', error)
      return false
    }
  }, [])

  const revoke = useCallback(async () => {
    try {
      // 這裡可以加入撤銷授權的 API 呼叫
      setAuthorized(false)
      return true
    } catch (error) {
      console.error('撤銷 Google 授權失敗:', error)
      setError('撤銷授權失敗')
      return false
    }
  }, [])

  return {
    ...state,
    authorize,
    checkAuthStatus,
    revoke,
    setError
  }
}