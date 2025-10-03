import { UserRole } from '@/hooks/use-registration-flow'

export interface UserRegistrationData {
  role: UserRole
  name: string
  googleEmail: string
  lineUserId: string
  registeredAt: string
}

export interface UserProfile {
  id: string
  role: UserRole
  name: string
  googleEmail: string
  lineUserId: string
  registeredAt: string
  lastLoginAt?: string
  isActive: boolean
}

/**
 * 在瀏覽器端一律走 Next 代理：
 *   /api/v2 → 代理到 BACKEND_API_URL/api/v2
 *   /api    → 代理到 BACKEND_API_URL/api
 * 在伺服器端才用環境變數組絕對路徑。
 */
function clientBase(prefix: 'v2' | 'api' | 'oauth'): string {
  if (typeof window !== 'undefined') {
    if (prefix === 'v2') return '/api/v2'
    if (prefix === 'oauth') return '/api/oauth'
    return '/api'
  }
  const root = (process.env.BACKEND_API_URL || '').replace(/\/+$/, '')
  if (prefix === 'v2') return `${root}/api/v2`
  if (prefix === 'oauth') return `${root}/api/oauth`
  return `${root}/api`
}

async function safeFetch(url: string, init?: RequestInit) {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(init?.headers || {}),
    },
    credentials: 'include',
    cache: 'no-store',
  })
  return resp
}

export class UserService {
  /**
   * 註冊新用戶並綁定 LINE User ID 與 Google Email
   */
  static async registerUser(data: UserRegistrationData): Promise<UserProfile> {
    const base = clientBase('api') // /api
    const resp = await safeFetch(`${base}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!resp.ok) throw new Error(`註冊失敗: ${resp.status} ${resp.statusText}`)
    return resp.json()
  }

  /**
   * 根據 LINE User ID 獲取用戶資料
   * 後端路由：/api/v2/profile/:lineUserId/
   */
  static async getUserByLineId(lineUserId: string): Promise<UserProfile | null> {
    const base = clientBase('v2') // /api/v2
    const resp = await safeFetch(`${base}/profile/${encodeURIComponent(lineUserId)}/`)
    if (resp.status === 404) return null
    if (!resp.ok) throw new Error(`獲取用戶資料失敗: ${resp.status} ${resp.statusText}`)
    return resp.json()
  }

  /**
   * 根據 Google Email 獲取用戶資料
   * （若你後端沒有這條，可移除或改成你實際的 API）
   */
  static async getUserByGoogleEmail(googleEmail: string): Promise<UserProfile | null> {
    const base = clientBase('api') // /api
    const resp = await safeFetch(`${base}/users/google/${encodeURIComponent(googleEmail)}`)
    if (resp.status === 404) return null
    if (!resp.ok) throw new Error(`獲取用戶資料失敗: ${resp.status} ${resp.statusText}`)
    return resp.json()
  }

  static async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const base = clientBase('api')
    const resp = await safeFetch(`${base}/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!resp.ok) throw new Error(`更新用戶資料失敗: ${resp.status} ${resp.statusText}`)
    return resp.json()
  }

  static async checkLineUserExists(lineUserId: string): Promise<boolean> {
    try {
      const user = await this.getUserByLineId(lineUserId)
      return user !== null
    } catch {
      return false
    }
  }

  static async checkGoogleEmailExists(googleEmail: string): Promise<boolean> {
    try {
      const user = await this.getUserByGoogleEmail(googleEmail)
      return user !== null
    } catch {
      return false
    }
  }

  static async bindLineAndGoogle(lineUserId: string, googleEmail: string): Promise<boolean> {
    const base = clientBase('api')
    const resp = await safeFetch(`${base}/users/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, googleEmail }),
    })
    if (!resp.ok) throw new Error(`綁定失敗: ${resp.status} ${resp.statusText}`)
    return true
  }

  static async recordLogin(lineUserId: string): Promise<void> {
    const base = clientBase('api')
    await safeFetch(`${base}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, loginAt: new Date().toISOString() }),
    })
  }

  static async sendRegistrationCompleteMessage(
    lineUserId: string,
    name: string,
    role: UserRole
  ): Promise<boolean> {
    const base = clientBase('api')
    const resp = await safeFetch(`${base}/line/render-flex/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_name: 'register_done',
        line_user_id: lineUserId,
        name,
        role,
      }),
    })
    if (!resp.ok) return false
    await resp.json().catch(() => ({}))
    return true
  }

  /**
   * ✅ 最重要：查詢是否已完成綁定（註冊完成）
   * 直接走相對路徑 /api/onboard/status/:lineUserId/（由 Next rewrites 代理）
   */
  static async getOnboardStatus(lineUserId: string): Promise<boolean> {
    try {
      const base = clientBase('api') // /api
      const url = `${base}/onboard/status/${encodeURIComponent(lineUserId)}/`
      console.log('[UserService] 查詢註冊狀態 URL:', url)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const resp = await safeFetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (!resp.ok) {
        console.error('查詢註冊狀態失敗:', resp.status, resp.statusText)
        return false
      }

      const ct = (resp.headers.get('content-type') || '').toLowerCase()
      if (!ct.includes('application/json')) {
        console.error('查詢註冊狀態失敗: 非 JSON 響應', ct)
        return false
      }

      const data = await resp.json().catch(() => null)
      return !!(data && (data as any).registered)
    } catch (e) {
      console.error('查詢註冊狀態失敗或逾時:', e)
      return false
    }
  }
}
