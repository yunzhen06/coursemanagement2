/**
 * CSRF Token 處理工具
 * 用於與 Django 後端的安全通訊
 */

/**
 * 從瀏覽器的 cookie 中取得 CSRF token
 */
export function getCsrfToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  const cookies = document.cookie.split(';')
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim()
    if (cookie.startsWith('csrftoken=')) {
      return decodeURIComponent(cookie.substring(10))
    }
  }
  return null
}

/**
 * 創建包含 CSRF token 的標頭物件
 */
export function createCsrfHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const csrfToken = getCsrfToken()
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken
  }
  
  return headers
}

/**
 * 發送 GET 請求來取得 CSRF token
 * 這通常在需要確保 CSRF token 存在時呼叫
 */
export async function fetchCsrfToken(csrfUrl: string): Promise<string | null> {
  try {
    // 如果沒有提供 URL，使用預設路徑
    const url = csrfUrl || '/api/csrf/'
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // 確保 cookies 被包含
      headers: {
        'ngrok-skip-browser-warning': 'true' // 避免 ngrok 警告頁面
      }
    })
    
    if (response.ok) {
      return getCsrfToken()
    } else {
      console.warn(`CSRF token 請求失敗: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.warn('無法取得 CSRF token:', error)
  }
  
  return null
}

