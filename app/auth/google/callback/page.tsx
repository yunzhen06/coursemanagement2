'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseLiffReturn } from '@/lib/line-liff'
import { UserService } from '@/services/userService'
import { ApiService } from '@/services/apiService'

export default function GoogleAuthSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'registered' | 'needs_registration'>('checking')

  useEffect(() => {
    const handleAuthSuccess = async () => {
      const params = new URLSearchParams(window.location.search)
      const email = params.get('email') || ''
      const lineUserIdParam = params.get('line_user_id') || ''

      // 若從 LIFF deep link 回來，參數同樣可讀
      const fromLiff = parseLiffReturn()
      const effectiveEmail = email || fromLiff.email || ''
      const effectiveId = lineUserIdParam || fromLiff.lineUserId || ''
      const redirectHint = fromLiff.redirect || ''
      const isRegisteredParam = params.get('registered') === 'true'

      try {
        if (effectiveId) ApiService.setLineUserId(effectiveId)
      } catch {}

      // 先查後端狀態（避免回去了還是看到註冊）
      let alreadyRegistered = false
      if (effectiveId) {
        try {
          alreadyRegistered = isRegisteredParam || (await UserService.getOnboardStatus(effectiveId))
        } catch {
          alreadyRegistered = false
        }
      }

      // —— 關鍵：把結果送回原分頁 —— //
      const payload = {
        type: 'GOOGLE_AUTH_RESULT',
        payload: {
          lineUserId: effectiveId,
          email: effectiveEmail,
          registered: alreadyRegistered,
        },
      }

      // 1) postMessage 回 opener（同網域）
      try {
        if (window.opener) {
          window.opener.postMessage(payload, window.location.origin)
        }
      } catch {}

      // 2) localStorage（觸發其他分頁的 storage 事件）
      try {
        localStorage.setItem('GOOGLE_AUTH_RESULT', JSON.stringify({ ...payload.payload, ts: Date.now() }))
      } catch {}

      // 若後端要求直接回首頁
      if (redirectHint === '/' || redirectHint === 'home' || alreadyRegistered) {
        setStatus('registered')
      } else {
        setStatus('needs_registration')
      }

      // 嘗試關閉自己（若由 window.open 開啟）
      try { window.close() } catch {}

      // 若關不掉，留一個按鈕讓使用者返回原分頁
    }

    handleAuthSuccess()
  }, [router])

  const getStatusMessage = () => {
    switch (status) {
      case 'checking': return '正在檢查註冊狀態...'
      case 'registered': return '授權完成，可回到原分頁'
      case 'needs_registration': return '授權完成，回原分頁繼續'
      default: return '處理中...'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <div className="text-center space-y-3">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-green-800">Google 授權成功</h1>
        <p className="text-green-700">{getStatusMessage()}</p>
        <button
          onClick={() => (window.location.href = '/registration')}
          className="mt-4 px-4 py-2 rounded bg-green-600 text-white"
        >
          回到註冊頁
        </button>
      </div>
    </div>
  )
}
