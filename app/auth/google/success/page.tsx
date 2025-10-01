'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseLiffReturn } from '@/lib/line-liff'

export default function GoogleAuthSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email') || ''
    const lineUserId = params.get('line_user_id') || ''

    // 若從 LIFF deep link 回來，參數同樣可讀
    const fromLiff = parseLiffReturn()
    const effectiveEmail = email || fromLiff.email || ''
    const effectiveId = lineUserId || fromLiff.lineUserId || ''

    try {
      if (effectiveId) {
        localStorage.setItem('lineUserId', effectiveId)
      }
    } catch {}

    // 導回註冊頁（或 LINE 主頁），由註冊頁自動檢查與完成流程
    setTimeout(() => {
      router.replace('/registration')
    }, 1000)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-800 mb-2">
          授權成功！
        </h1>
        <p className="text-green-600">
          Google 授權已完成，正在返回註冊頁...
        </p>
      </div>
    </div>
  )
}