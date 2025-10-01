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
      const lineUserId = params.get('line_user_id') || ''

      // 若從 LIFF deep link 回來，參數同樣可讀
      const fromLiff = parseLiffReturn()
      const effectiveEmail = email || fromLiff.email || ''
      const effectiveId = lineUserId || fromLiff.lineUserId || ''
      const redirectHint = fromLiff.redirect || ''

      // 僅設定記憶體中的 lineUserId，不寫入 localStorage
      if (effectiveId) {
        ApiService.setLineUserId(effectiveId)
      }

      // 若後端標示回到首頁（redirect=/），直接導回首頁，不進入註冊頁邏輯
      if (redirectHint === '/') {
        setStatus('registered')
        setTimeout(() => {
          router.replace('/')
        }, 800)
        return
      }

      // 檢查用戶是否已完成註冊
      if (effectiveId) {
        try {
          const isRegistered = await UserService.getOnboardStatus(effectiveId)
          if (isRegistered) {
            setStatus('registered')
            // 已註冊用戶直接跳轉到主頁
            setTimeout(() => {
              router.replace('/')
            }, 1500)
          } else {
            setStatus('needs_registration')
            // 未完成註冊的用戶通知父頁面或跳轉到註冊頁
            setTimeout(() => {
              router.replace('/registration')
            }, 1500)
          }
        } catch (error) {
          console.error('檢查註冊狀態失敗:', error)
          setStatus('needs_registration')
          setTimeout(() => {
            router.replace('/registration')
          }, 1500)
        }
      } else {
        setStatus('needs_registration')
        setTimeout(() => {
          router.replace('/registration')
        }, 1500)
      }
    }

    handleAuthSuccess()
  }, [router])

  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return '正在檢查註冊狀態...'
      case 'registered':
        return '授權完成，正在跳轉到主頁...'
      case 'needs_registration':
        return '授權完成，正在跳轉到註冊頁...'
      default:
        return '處理中...'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-800 mb-2">
          授權成功！
        </h1>
        <p className="text-green-600">
          {getStatusMessage()}
        </p>
      </div>
    </div>
  )
}