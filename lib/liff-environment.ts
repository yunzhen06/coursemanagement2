/**
 * LIFF 環境檢測和處理工具
 * 專門處理 LINE LIFF 環境中的特殊需求
 */

import { isInLineApp, openExternalUrl } from './line-liff'

/**
 * 檢測當前是否在 LIFF 環境中
 */
export function isLiffEnvironment(): boolean {
  try {
    return isInLineApp()
  } catch {
    return false
  }
}

/**
 * 檢測是否為行動裝置
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * 在 LIFF 環境中開啟外部 URL（Google OAuth）
 * 會自動選擇最適合的開啟方式
 */
export function openGoogleAuthInLiff(authUrl: string): void {
  if (isLiffEnvironment()) {
    // 在 LIFF 環境中，使用 external: true 開啟外部瀏覽器
    openExternalUrl(authUrl)
  } else {
    // 非 LIFF 環境，使用標準的新視窗開啟
    window.open(authUrl, '_blank', 'noopener,noreferrer')
  }
}

/**
 * 處理 Google OAuth 回調的 postMessage
 */
export function setupGoogleAuthMessageListener(
  onSuccess: (data: { email: string; line_user_id: string; registered?: boolean }) => void,
  onError: (error: string) => void
): () => void {
  const handleMessage = (event: MessageEvent) => {
    // 只接受來自同源的訊息
    if (event.origin !== window.location.origin) {
      return
    }

    if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
      onSuccess({
        email: event.data.email || '',
        line_user_id: event.data.line_user_id || '',
        registered: event.data.registered
      })
    } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
      onError(event.data.error || '授權失敗')
    }
  }

  window.addEventListener('message', handleMessage)

  // 返回清理函數
  return () => {
    window.removeEventListener('message', handleMessage)
  }
}

/**
 * 檢查 URL 參數中是否包含 Google OAuth 回調數據
 */
export function parseGoogleAuthCallback(): {
  email: string
  lineUserId: string
  hasCallback: boolean
} {
  if (typeof window === 'undefined') {
    return { email: '', lineUserId: '', hasCallback: false }
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email') || ''
    const lineUserId = params.get('line_user_id') || ''
    
    return {
      email,
      lineUserId,
      hasCallback: !!(email || lineUserId)
    }
  } catch {
    return { email: '', lineUserId: '', hasCallback: false }
  }
}

/**
 * 清理 URL 中的 OAuth 回調參數
 */
export function cleanupOAuthParams(): void {
  if (typeof window === 'undefined') return

  try {
    const url = new URL(window.location.href)
    const paramsToRemove = ['email', 'line_user_id', 'code', 'state']
    
    let hasChanges = false
    paramsToRemove.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        hasChanges = true
      }
    })

    if (hasChanges) {
      window.history.replaceState({}, '', url.toString())
    }
  } catch (error) {
    console.warn('清理 OAuth 參數失敗:', error)
  }
}

/**
 * 獲取 LIFF 環境資訊
 */
export function getLiffEnvironmentInfo() {
  return {
    isLiff: isLiffEnvironment(),
    isMobile: isMobileDevice(),
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
    platform: typeof window !== 'undefined' ? navigator.platform : 'N/A',
    language: typeof window !== 'undefined' ? navigator.language : 'N/A'
  }
}