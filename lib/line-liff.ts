import liff from '@line/liff'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

// 檢查是否為開發環境
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.NEXT_PUBLIC_IS_DEVELOPMENT === 'true'

// LINE LIFF 配置
export const LIFF_CONFIG = {
  liffId: publicRuntimeConfig.liffId || '', // 從 publicRuntimeConfig 取得 LIFF ID
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'https://your-domain.com',
  // 開發環境配置
  isDevelopment,
  devUrl: process.env.NEXT_PUBLIC_DEV_URL || 'http://localhost:3000',
  ngrokUrl: process.env.NEXT_PUBLIC_NGROK_URL || 'https://dbf020ae1fc8.ngrok-free.app'
}

// LIFF 初始化
export const initializeLiff = async (): Promise<boolean> => {
  try {
    if (!LIFF_CONFIG.liffId) {
      console.error('LIFF ID 未設定')
      return false
    }
    
    // 在開發環境中，抑制 URL 不匹配的警告
    if (LIFF_CONFIG.isDevelopment) {
      console.log('🔧 開發環境：正在初始化 LIFF...')
      console.log(`📍 當前 URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`)
      console.log(`🌐 配置的端點: ${LIFF_CONFIG.redirectUri}`)
      console.log('⚠️  開發環境中 URL 不匹配是正常的，LIFF 仍會正常運作')
      
      // 暫時攔截 console.warn 來抑制 LIFF URL 警告
      const originalWarn = console.warn
      console.warn = (...args) => {
        const message = args.join(' ')
        // 只攔截 LIFF URL 相關的警告
        if (message.includes('liff.init() was called with a current URL that is not related to the endpoint URL')) {
          console.log('🔇 已抑制 LIFF URL 警告（開發環境正常現象）')
          return
        }
        // 其他警告正常顯示
        originalWarn.apply(console, args)
      }
      
      try {
        await liff.init({ liffId: LIFF_CONFIG.liffId })
        console.log('LIFF 初始化成功')
        return true
      } finally {
        // 恢復原始的 console.warn
        console.warn = originalWarn
      }
    } else {
      // 生產環境正常初始化
      await liff.init({ liffId: LIFF_CONFIG.liffId })
      console.log('LIFF 初始化成功')
      return true
    }
  } catch (error) {
    console.error('LIFF 初始化失敗:', error)
    return false
  }
}

// 檢查是否在 LINE 內瀏覽器
export const isInLineApp = (): boolean => {
  try {
    return liff.isInClient()
  } catch (error) {
    console.error('檢查 LINE 應用狀態失敗:', error)
    return false
  }
}

// 檢查用戶是否已登入
export const isLoggedIn = (): boolean => {
  try {
    return liff.isLoggedIn()
  } catch (error) {
    console.error('檢查 LINE 登入狀態失敗:', error)
    return false
  }
}

// LINE 登入
export const lineLogin = (): void => {
  if (!liff.isLoggedIn()) {
    liff.login({
      redirectUri: LIFF_CONFIG.redirectUri
    })
  }
}

// LINE 登出
export const lineLogout = (): void => {
  if (liff.isLoggedIn()) {
    liff.logout()
  }
}

// 取得用戶資料
export const getUserProfile = async () => {
  try {
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile()
      return {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage
      }
    }
    return null
  } catch (error) {
    console.error('取得用戶資料失敗:', error)
    return null
  }
}

// 取得存取權杖
export const getAccessToken = (): string | null => {
  try {
    if (liff.isLoggedIn()) {
      return liff.getAccessToken()
    }
    return null
  } catch (error) {
    console.error('取得存取權杖失敗:', error)
    return null
  }
}

// 關閉 LIFF 視窗
export const closeLiffWindow = (): void => {
  if (liff.isInClient()) {
    liff.closeWindow()
  }
}

// 傳送訊息到 LINE 聊天室
export const sendMessageToLine = (message: string): void => {
  if (liff.isInClient()) {
    liff.sendMessages([
      {
        type: 'text',
        text: message
      }
    ])
  }
}

// 分享到 LINE
export const shareToLine = (url: string, text: string): void => {
  if (liff.isInClient()) {
    liff.shareTargetPicker([
      {
        type: 'text',
        text: `${text}\n${url}`
      }
    ])
  }
}

// 取得 LINE 環境資訊
export const getLineEnvironment = () => {
  return {
    isInClient: liff.isInClient(),
    isLoggedIn: liff.isLoggedIn(),
    os: liff.getOS(),
    language: liff.getLanguage(),
    version: liff.getVersion(),
    lineVersion: liff.getLineVersion(),
    isApiAvailable: (api: string) => liff.isApiAvailable(api)
  }
}

// 開發環境輔助函數
export const getDevelopmentInfo = () => {
  if (!LIFF_CONFIG.isDevelopment) return null
  
  return {
    isDevelopment: LIFF_CONFIG.isDevelopment,
    currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
    configuredEndpoint: LIFF_CONFIG.redirectUri,
    devUrl: LIFF_CONFIG.devUrl,
    ngrokUrl: LIFF_CONFIG.ngrokUrl,
    message: '開發環境中 LIFF URL 不匹配是正常現象，不會影響功能'
  }
}

// 檢查 LIFF 配置是否正確
export const validateLiffConfig = () => {
  const issues: string[] = []
  
  if (!LIFF_CONFIG.liffId) {
    issues.push('LIFF ID 未設定')
  }
  
  if (!LIFF_CONFIG.redirectUri || LIFF_CONFIG.redirectUri === 'https://your-domain.com') {
    issues.push('重定向 URI 未正確設定')
  }
  
  if (LIFF_CONFIG.isDevelopment) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    if (currentUrl.startsWith('http://localhost') && !LIFF_CONFIG.redirectUri.includes('ngrok')) {
      issues.push('開發環境建議使用 ngrok URL 作為重定向 URI')
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    config: LIFF_CONFIG
  }
}