/**
 * LIFF 環境檢測和處理工具
 * 專門處理 LINE LIFF 環境中的特殊需求
 */

import { isInLineApp, openExternalUrl, initializeLiff } from './line-liff'

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

// 檢測是否在 LINE 內建瀏覽器（非 LIFF 容器）
export function isLineInAppBrowser(): boolean {
  try {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    // LINE 內建瀏覽器 UA 通常包含 "Line/"
    return /Line\//i.test(ua)
  } catch {
    return false
  }
}

/**
 * 在 LIFF 環境中開啟外部 URL（Google OAuth）
 * 會自動選擇最適合的開啟方式
 */
export function openGoogleAuthInLiff(authUrl: string): void {
  try {
    // 在 LIFF 容器中：初始化後使用 openWindow external
    if (isLiffEnvironment()) {
      const initPromise = initializeLiff()
      initPromise
        .then(() => {
          openExternalUrl(authUrl)
        })
        .catch(() => {
          // 初始化失敗仍嘗試以外部方式開啟
          openExternalUrl(authUrl)
        })
      return
    }

    // 非 LIFF，但在 LINE 內建瀏覽器：直接使用平台特定方式開啟外部瀏覽器
    if (isLineInAppBrowser()) {
      try {
        if (typeof navigator !== 'undefined') {
          const ua = navigator.userAgent || ''
          const isAndroid = /Android/i.test(ua)
          const isIOS = /iPhone|iPad|iPod/i.test(ua)

          if (isAndroid) {
            // 以 Chrome intent 方式開啟
            const stripped = authUrl.replace(/^https?:\/\//, '')
            const intentUrl = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(authUrl)};end`
            window.location.href = intentUrl
            return
          }

          if (isIOS) {
            // 嘗試以 Chrome scheme 開啟；未安裝 Chrome 會失敗，瀏覽器會停留
            const chromeUrl = authUrl.startsWith('https://')
              ? authUrl.replace('https://', 'googlechromes://')
              : authUrl.replace('http://', 'googlechrome://')
            window.location.href = chromeUrl
            // 若失敗，稍後使用一般新分頁（依舊可能留在內嵌，但無 LIFF）
            setTimeout(() => {
              try {
                window.open(authUrl, '_blank', 'noopener,noreferrer')
              } catch {}
            }, 800)
            return
          }
        }
      } catch (e) {
        console.warn('直接開啟外部瀏覽器失敗，回退新分頁:', e)
      }
      // 其他平台或失敗：一般新分頁
      window.open(authUrl, '_blank', 'noopener,noreferrer')
      return
    }

    // 非 LINE 內建瀏覽器：一般新分頁
    window.open(authUrl, '_blank', 'noopener,noreferrer')
  } catch {
    // 最終備援：非 LIFF 環境使用一般新視窗
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