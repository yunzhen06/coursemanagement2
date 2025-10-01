import { useState, useEffect } from 'react'
import { ApiService } from '@/services/apiService'
import { 
  initializeLiff, 
  isInLineApp, 
  isLoggedIn, 
  getUserProfile, 
  lineLogin, 
  lineLogout,
  getLineEnvironment,
  getDevelopmentInfo,
  validateLiffConfig
} from '@/lib/line-liff'

// 本地預設跳過條件：顯式設定或開發環境且未設定 LIFF ID
const shouldSkipLiffLocal = (
  process.env.NEXT_PUBLIC_SKIP_LIFF_LOCAL === 'true' ||
  (!process.env.NEXT_PUBLIC_LIFF_ID && (process.env.NODE_ENV !== 'production'))
)

interface LineUser {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

interface LineAuthState {
  isInitialized: boolean
  isInLineApp: boolean
  isLoggedIn: boolean
  user: LineUser | null
  isLoading: boolean
  error: string | null
}

export const useLineAuth = () => {
  const [state, setState] = useState<LineAuthState>({
    isInitialized: false,
    isInLineApp: false,
    isLoggedIn: false,
    user: null,
    isLoading: true,
    error: null
  })

  // 初始化 LIFF 並在未登入時自動觸發登入
  useEffect(() => {
    const initLiff = async () => {
      try {
        // 全域清除前端 localStorage（一次性於此 hook 啟動時執行）
        try {
          if (typeof window !== 'undefined') {
            localStorage.clear()
          }
        } catch {}

        // 在本地或未設定 LIFF ID 時，直接跳過；不再使用 localStorage 生成或保存假 userId
        if (shouldSkipLiffLocal) {
          setState({
            isInitialized: true,
            isInLineApp: false,
            isLoggedIn: false,
            user: null,
            isLoading: false,
            error: null
          })
          console.log('✅ 本地模式：已跳過 LIFF')
          return
        }

        console.log('🔄 useLineAuth: 設置 loading 狀態')
        setState(prev => ({ ...prev, isLoading: true, error: null }))
        // 不再讀寫 localStorage，直接由 LIFF 登入同步真實 lineUserId
        
        console.log('🚀 useLineAuth: 調用 initializeLiff')
        const initialized = await initializeLiff()
        console.log('✅ useLineAuth: initializeLiff 結果:', initialized)
        
        if (initialized) {
          const inLineApp = isInLineApp()
          const loggedIn = isLoggedIn()
          
          console.log('🔍 useLineAuth: 檢查狀態', { inLineApp, loggedIn })

          // 未登入時自動觸發 LINE 登入（需要正確的 redirectUri 配置）
          if (!loggedIn) {
            // 僅當顯式設定跳過時不導向
            if (shouldSkipLiffLocal) {
              console.log('🏁 已設定跳過 LIFF 登入導向')
              setState({
                isInitialized: true,
                isInLineApp: false,
                isLoggedIn: false,
                user: null,
                isLoading: false,
                error: null
              })
              return
            }
            const configCheck = validateLiffConfig()
            if (configCheck.isValid) {
              console.log('👉 未登入，自動觸發 LINE 授權導向')
              // 保持 loading 狀態直到導向發生
              setState({
                isInitialized: true,
                isInLineApp: inLineApp,
                isLoggedIn: false,
                user: null,
                isLoading: true,
                error: null
              })
              lineLogin()
              return
            } else {
              console.warn('⚠️ LIFF 配置不正確，無法自動登入', configCheck.issues)
              setState({
                isInitialized: true,
                isInLineApp: inLineApp,
                isLoggedIn: false,
                user: null,
                isLoading: false,
                error: `LIFF 配置問題：${configCheck.issues.join(', ')}`
              })
              return
            }
          }
          
          let user: LineUser | null = null
          if (loggedIn) {
            console.log('👤 useLineAuth: 獲取用戶資料')
            user = await getUserProfile()
            console.log('👤 useLineAuth: 用戶資料:', user)
            // 登入後同步真實 lineUserId 至 ApiService（不使用 localStorage）
            if (user?.userId) {
              ApiService.setLineUserId(user.userId)
            }
          }
          
          console.log('✅ useLineAuth: 設置最終狀態')
          setState({
            isInitialized: true,
            isInLineApp: inLineApp,
            isLoggedIn: loggedIn,
            user,
            isLoading: false,
            error: null
          })
        } else {
          console.log('❌ useLineAuth: 初始化失敗')
          setState(prev => ({
            ...prev,
            isInitialized: false,
            isLoading: false,
            error: 'LIFF 初始化失敗'
          }))
        }
      } catch (error) {
        console.error('💥 useLineAuth: 初始化錯誤:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '未知錯誤'
        }))
      }
    }

    initLiff()
  }, [])

  // 登入（保留為備援）
  const login = () => {
    try {
      lineLogin()
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '登入失敗'
      }))
    }
  }

  // 登出
  const logout = () => {
    try {
      lineLogout()
      setState(prev => ({
        ...prev,
        isLoggedIn: false,
        user: null
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '登出失敗'
      }))
    }
  }

  // 重新整理用戶資料
  const refreshUser = async () => {
    try {
      if (isLoggedIn()) {
        const user = await getUserProfile()
        setState(prev => ({ ...prev, user }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '取得用戶資料失敗'
      }))
    }
  }

  // 取得 LINE 環境資訊
  const getEnvironmentInfo = () => {
    return getLineEnvironment()
  }

  // 取得開發環境資訊
  const getDevInfo = () => {
    return getDevelopmentInfo()
  }

  // 驗證 LIFF 配置
  const validateConfig = () => {
    return validateLiffConfig()
  }

  return {
    ...state,
    login,
    logout,
    refreshUser,
    getEnvironmentInfo,
    getDevInfo,
    validateConfig
  }
}