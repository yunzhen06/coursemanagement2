'use client'

import { useState, useCallback } from 'react'
import { ApiService } from '@/services/apiService'

export interface GoogleAuthState {
  isAuthorized: boolean
  isLoading: boolean
  error: string | null
  userEmail: string | null
}

export function useGoogleAuth() {
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

  const authorize = useCallback(async (): Promise<string | null> => {
    setLoading(true)
    setError(null)

    try {
      // 從後端獲取 Google OAuth URL
      const { redirectUrl } = await ApiService.getGoogleOAuthUrl()
      
      // 在新視窗中打開 Google 授權頁面
      const authWindow = window.open(
        redirectUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )

      return new Promise((resolve, reject) => {
        // 監聽來自授權頁面的 postMessage
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) {
            return
          }

          if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage)
            authWindow?.close()
            
            // 假設成功後會返回用戶 email
            const userEmail = event.data.email || 'user@gmail.com'
            setAuthorized(true, userEmail)
            setLoading(false)
            resolve(userEmail)
          } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
            window.removeEventListener('message', handleMessage)
            authWindow?.close()
            setError('授權失敗')
            setLoading(false)
            reject(new Error('授權失敗'))
          }
        }

        window.addEventListener('message', handleMessage)

        // 備用方案：定期檢查視窗是否關閉
        const checkWindowClosed = setInterval(() => {
          try {
            if (authWindow?.closed) {
              clearInterval(checkWindowClosed)
              window.removeEventListener('message', handleMessage)
            
            // 檢查授權狀態
            setTimeout(async () => {
              try {
                const response = await ApiService.testGoogleConnection()
                if (response.data && (response.data as any).is_connected) {
                  // 模擬獲取用戶 email
                  const userEmail = 'user@gmail.com'
                  setAuthorized(true, userEmail)
                  resolve(userEmail)
                } else {
                  setError('授權未完成或失敗')
                  reject(new Error('授權未完成或失敗'))
                }
              } catch (error) {
                setError('檢查授權狀態失敗')
                reject(new Error('檢查授權狀態失敗'))
              }
              setLoading(false)
            }, 1000)
            }
          } catch (error) {
            // 忽略 CORS 錯誤，繼續檢查
            console.warn('無法檢查視窗狀態 (CORS):', error)
          }
        }, 1000)

        // 10分鐘後自動停止檢查
        setTimeout(() => {
          clearInterval(checkWindowClosed)
          window.removeEventListener('message', handleMessage)
          if (authWindow && !authWindow.closed) {
            authWindow.close()
          }
          setLoading(false)
          reject(new Error('授權超時'))
        }, 600000)
      })
    } catch (error) {
      console.error('Google 授權失敗:', error)
      setError('授權過程中發生錯誤')
      setLoading(false)
      throw error
    }
  }, [])

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