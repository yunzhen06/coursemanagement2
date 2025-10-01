'use client'

import { useState, useCallback } from 'react'
import { ApiService } from '@/services/apiService'
import { getIdToken, openExternalUrl, parseLiffReturn } from '@/lib/line-liff'
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
            // 預註冊失敗時，改用直接 OAuth
            resp = await ApiService.getGoogleOAuthUrl()
          }
        } else {
          // 取不到 id_token 時退回直接 OAuth
          resp = await ApiService.getGoogleOAuthUrl()
        }
      } else {
        // 2) 其他情況（非 LIFF 或沒有 role/name），走直接 OAuth（csrf_exempt）
        resp = await ApiService.getGoogleOAuthUrl()
      }

      // 若預註冊返回錯誤或未取得連結，嘗試再取一次直接 OAuth 連結
      if (resp?.error) {
        try {
          resp = await ApiService.getGoogleOAuthUrl()
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

      // 使用 LIFF external 開啟授權連結；回到 LIFF 後由 parseLiffReturn 解析
      openExternalUrl(redirectUrl)

      return new Promise((resolve, reject) => {
        // 輕量輪詢：等待返回 LIFF（URL 攜帶 email/line_user_id）或後端連線已建立
        const startedAt = Date.now()
        const poll = setInterval(async () => {
          // 超時 10 分鐘
          if (Date.now() - startedAt > 10 * 60 * 1000) {
            clearInterval(poll)
            setLoading(false)
            setError('授權超時')
            reject(new Error('授權超時'))
            return
          }

          try {
            const ret = parseLiffReturn()
            if ((ret.email && ret.email.includes('@')) || ret.lineUserId) {
              // 儲存 line_user_id 以備之後 API 使用
              if (ret.lineUserId) {
                ApiService.setLineUserId(ret.lineUserId)
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lineUserId', ret.lineUserId)
                }
              }
              const userEmail = ret.email || 'user@gmail.com'
              setAuthorized(true, userEmail)
              clearInterval(poll)
              setLoading(false)
              resolve(userEmail)
              return
            }

            // 後端連線測試作為備援
            const response = await ApiService.testGoogleConnection()
            if (response.data && (response.data as any).is_connected) {
              const userEmail = 'user@gmail.com'
              setAuthorized(true, userEmail)
              clearInterval(poll)
              setLoading(false)
              resolve(userEmail)
              return
            }
          } catch (e) {
            // 忽略暫時性錯誤，繼續輪詢
          }
        }, 1000)
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
      const response = await ApiService.testGoogleConnection()
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