'use client'

import { useEffect, useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testDirectFetch = async () => {
    setLoading(true)
    setResult('開始測試...\n')
    
    try {
      // 檢查環境變數
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      setResult(prev => prev + `環境變數 NEXT_PUBLIC_API_BASE_URL: ${apiBaseUrl}\n`)
      
      if (!apiBaseUrl) {
        setResult(prev => prev + '❌ 環境變數未設定\n')
        return
      }
      
      // 測試 API 請求
      const url = `${apiBaseUrl}/web/courses/list/?line_user_id=guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f&_ts=${Date.now()}`
      setResult(prev => prev + `請求 URL: ${url}\n`)
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Line-User-Id': 'guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f',
        'ngrok-skip-browser-warning': 'true'
      }
      
      setResult(prev => prev + '發送請求...\n')
      
      const response = await fetch(url, { 
        method: 'GET',
        headers 
      })
      
      setResult(prev => prev + `響應狀態: ${response.status} ${response.statusText}\n`)
      
      const text = await response.text()
      setResult(prev => prev + `響應內容 (前 200 字符): ${text.substring(0, 200)}\n`)
      
      if (response.ok) {
        try {
          const json = JSON.parse(text)
          if (json.success && json.data && json.data.courses) {
            setResult(prev => prev + `✅ 成功獲取 ${json.data.courses.length} 個課程\n`)
            json.data.courses.forEach((course: any, index: number) => {
              setResult(prev => prev + `  課程 ${index + 1}: ${course.title}\n`)
            })
          } else {
            setResult(prev => prev + '❌ 響應格式不正確\n')
          }
        } catch (e) {
          setResult(prev => prev + '❌ 響應不是有效的 JSON\n')
        }
      } else {
        setResult(prev => prev + '❌ API 請求失敗\n')
      }
      
    } catch (error) {
      setResult(prev => prev + `❌ 錯誤: ${error}\n`)
    } finally {
      setLoading(false)
    }
  }

  const testApiService = async () => {
    setLoading(true)
    setResult('測試 ApiService...\n')
    
    try {
      const { ApiService } = await import('@/services/apiService')
      
      setResult(prev => prev + '調用 ApiService.getCourses...\n')
      const result = await ApiService.getCourses('guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f')
      
      setResult(prev => prev + `ApiService 結果: ${JSON.stringify(result, null, 2)}\n`)
      
      if (result.error) {
        setResult(prev => prev + `❌ ApiService 錯誤: ${result.error}\n`)
      } else if (result.data) {
        setResult(prev => prev + `✅ ApiService 成功獲取 ${result.data.length} 個課程\n`)
        result.data.forEach((course: any, index: number) => {
          setResult(prev => prev + `  課程 ${index + 1}: ${course.title}\n`)
        })
      }
    } catch (error) {
      setResult(prev => prev + `❌ ApiService 錯誤: ${error}\n`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">API 連接測試</h1>
      
      <div className="space-x-4 mb-6">
        <button 
          onClick={testDirectFetch}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '測試中...' : '測試直接 Fetch'}
        </button>
        
        <button 
          onClick={testApiService}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '測試中...' : '測試 ApiService'}
        </button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">測試結果:</h2>
        <pre className="whitespace-pre-wrap text-sm">{result || '點擊按鈕開始測試'}</pre>
      </div>
    </div>
  )
}