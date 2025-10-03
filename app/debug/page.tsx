'use client'

import { useEffect, useState } from 'react'

export default function DebugPage() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({})

  useEffect(() => {
    // 檢查環境變數
    setEnvVars({
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'undefined',
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'undefined',
      NEXT_PUBLIC_GOOGLE_REDIRECT_URI: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'undefined',
      NEXT_PUBLIC_REDIRECT_URI: process.env.NEXT_PUBLIC_REDIRECT_URI || 'undefined',
    })
  }, [])

  const testApiConnection = async () => {
    try {
      console.log('🔍 測試 API 連接...')
      console.log('API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL)
      
      const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/web/courses/list/?line_user_id=guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f&_ts=${Date.now()}`
      console.log('請求 URL:', url)
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Line-User-Id': 'guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f',
        'ngrok-skip-browser-warning': 'true'
      }
      console.log('請求 Headers:', headers)
      
      const response = await fetch(url, { headers })
      
      console.log('✅ API Response Status:', response.status)
      console.log('✅ API Response Headers:', Object.fromEntries(response.headers.entries()))
      
      const text = await response.text()
      console.log('✅ API Response Text (前 500 字符):', text.substring(0, 500))
      
      try {
        const json = JSON.parse(text)
        console.log('✅ API Response JSON:', json)
        
        if (json.success && json.data && json.data.courses) {
          console.log(`✅ 成功獲取 ${json.data.courses.length} 個課程`)
          json.data.courses.forEach((course: any, index: number) => {
            console.log(`課程 ${index + 1}:`, course.title, course.id)
          })
        }
      } catch (e) {
        console.log('❌ Response is not JSON:', text)
      }
    } catch (error) {
      console.error('❌ API Test Error:', error)
    }
  }

  const testApiServiceConnection = async () => {
    try {
      console.log('🔍 測試 ApiService.getCourses...')
      
      // 動態導入 ApiService 以確保在客戶端執行
      const { ApiService } = await import('@/services/apiService')
      
      const result = await ApiService.getCourses('guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f')
      console.log('✅ ApiService.getCourses 結果:', result)
      
      if (result.error) {
        console.error('❌ ApiService 錯誤:', result.error)
      } else if (result.data) {
        console.log(`✅ ApiService 成功獲取 ${result.data.length} 個課程`)
        result.data.forEach((course: any, index: number) => {
          console.log(`課程 ${index + 1}:`, course.title, course.id)
        })
      }
    } catch (error) {
      console.error('❌ ApiService Test Error:', error)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Debug 頁面</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">環境變數</h2>
        <div className="bg-gray-100 p-4 rounded">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="mb-2">
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">API 連接測試</h2>
        <div className="space-x-4">
          <button 
            onClick={testApiConnection}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            測試直接 API 連接
          </button>
          <button 
            onClick={testApiServiceConnection}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            測試 ApiService
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          請打開瀏覽器開發者工具的 Console 查看詳細結果
        </p>
      </div>
    </div>
  )
}