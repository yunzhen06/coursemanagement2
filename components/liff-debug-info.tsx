'use client'

import { useLineAuth } from '@/hooks/use-line-auth'

export const LiffDebugInfo = () => {
  const { getDevInfo, validateConfig, isInitialized } = useLineAuth()

  if (!isInitialized) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-800">LIFF 正在初始化...</h3>
      </div>
    )
  }

  const devInfo = getDevInfo()
  const configValidation = validateConfig()

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
      <h3 className="font-semibold text-blue-800">LIFF 調試資訊</h3>
      
      {devInfo && (
        <div className="text-sm">
          <p><strong>開發環境：</strong> {devInfo.isDevelopment ? '是' : '否'}</p>
          <p><strong>當前 URL：</strong> {devInfo.currentUrl}</p>
          <p><strong>配置端點：</strong> {devInfo.configuredEndpoint}</p>
          <p className="text-blue-600 mt-2">{devInfo.message}</p>
        </div>
      )}
      
      <div className="text-sm">
        <p><strong>配置驗證：</strong> {configValidation.isValid ? '✅ 正常' : '❌ 有問題'}</p>
        {configValidation.issues.length > 0 && (
          <ul className="list-disc list-inside text-red-600 mt-1">
            {configValidation.issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

