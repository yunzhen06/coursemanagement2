'use client'

import { useEffect } from 'react'

export default function GoogleAuthSuccessPage() {
  useEffect(() => {
    // 通知父視窗授權成功
    if (window.opener) {
      const params = new URLSearchParams(window.location.search)
      const email = params.get('email') || ''
      window.opener.postMessage(
        { type: 'GOOGLE_AUTH_SUCCESS', email },
        window.location.origin
      )
    }
    
    // 關閉視窗
    setTimeout(() => {
      window.close()
    }, 1000)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-800 mb-2">
          授權成功！
        </h1>
        <p className="text-green-600">
          Google Classroom 已成功連接，視窗即將關閉...
        </p>
      </div>
    </div>
  )
}