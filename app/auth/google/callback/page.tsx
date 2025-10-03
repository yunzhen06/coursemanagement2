'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseLiffReturn } from '@/lib/line-liff'
import { UserService } from '@/services/userService'
import { ApiService } from '@/services/apiService'

export default function GoogleAuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ok'>('checking')

  useEffect(() => {
    const handleAuthSuccess = async () => {
      const params = new URLSearchParams(window.location.search)
      const emailParam = params.get('email') || ''
      const idFromQuery = params.get('line_user_id') || ''
      const isRegisteredParam = params.get('registered') === 'true'

      // 兼容 LIFF deep link 回來的參數
      const fromLiff = parseLiffReturn()
      const effectiveEmail = emailParam || fromLiff.email || ''
      const effectiveId = idFromQuery || fromLiff.lineUserId || ''

      // 設定前端 ApiService 的 lineUserId（讓後續 API 能帶 header）
      try { if (effectiveId) ApiService.setLineUserId(effectiveId) } catch {}

      // 先向後端確認是否已完成綁定（避免原分頁還卡註冊第一步）
      let alreadyRegistered = false
      if (effectiveId) {
        try {
          alreadyRegistered = isRegisteredParam || (await UserService.getOnboardStatus(effectiveId))
        } catch {
          alreadyRegistered = isRegisteredParam || false
        }
      }

      // 把授權結果「送回原分頁」
      const message = {
        type: 'GOOGLE_AUTH_RESULT',
        payload: {
          lineUserId: effectiveId,
          email: effectiveEmail,
          registered: alreadyRegistered,
        },
      }

      // 1) 優先用 postMessage 回傳（同網域最佳）
      try {
        if (window.opener) {
          window.opener.postMessage(message, window.location.origin)
        }
      } catch {}

      // 2) 備援：localStorage 觸發原分頁的 storage 事件
      try {
        localStorage.setItem(
          'GOOGLE_AUTH_RESULT',
          JSON.stringify({ ...message.payload, ts: Date.now() })
        )
      } catch {}

      setStatus('ok')

      // 嘗試關閉自己（若由 window.open 打開）
      try { window.close() } catch {}

      // 再保險：2 秒後若還沒關閉，就保持在本頁顯示「回到註冊」按鈕
      setTimeout(() => {
        try { window.close() } catch {}
      }, 2000)
    }

    handleAuthSuccess()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <div className="text-center space-y-3">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-green-800">Google 授權成功</h1>
        <p className="text-green-700">
          {status === 'checking' ? '正在處理授權結果…' : '可關閉此分頁，原分頁會自動更新狀態'}
        </p>
        <button
          onClick={() => router.replace('/registration')}
          className="mt-4 px-4 py-2 rounded bg-green-600 text-white"
        >
          回到註冊頁
        </button>
      </div>
    </div>
  )
}
