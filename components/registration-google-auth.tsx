'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Shield, CheckCircle, Mail, Calendar, BookOpen, GraduationCap, Users } from 'lucide-react'
import { UserRole } from '@/hooks/use-registration-flow'

interface GoogleAuthProps {
  name: string
  role: UserRole | null
  googleEmail: string
  lineUserId: string
  isLoading: boolean
  isGoogleLoading?: boolean
  onGoogleAuth: () => void
  onPrev: () => void
}

export function RegistrationGoogleAuth({
  name,
  role,
  googleEmail,
  lineUserId,
  isLoading,
  isGoogleLoading = false,
  onGoogleAuth,
  onPrev
}: GoogleAuthProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const handleGoogleAuth = async () => {
    setIsAuthenticating(true)
    try {
      await onGoogleAuth()
    } finally {
      setIsAuthenticating(false)
    }
  }

  const getRoleInfo = () => {
    if (role === 'teacher') {
      return {
        title: '老師',
        icon: GraduationCap,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      }
    } else if (role === 'student') {
      return {
        title: '學生',
        icon: Users,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      }
    }
    return {
      title: '用戶',
      icon: Shield,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    }
  }

  const roleInfo = getRoleInfo()
  const RoleIcon = roleInfo.icon

  const permissions = [
    {
      icon: Mail,
      title: '電子郵件',
      description: '用於帳號識別和通知'
    },
    {
      icon: Calendar,
      title: 'Google 日曆',
      description: '同步課程和作業時間'
    },
    {
      icon: BookOpen,
      title: 'Google Classroom',
      description: '匯入課程和作業資料'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* 標題區域 */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Google 帳號授權
            </h1>
            <p className="text-gray-600">
              連接您的 Google 帳號以享受完整功能
            </p>
          </div>
        </div>

        {/* 進度指示器 */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
            ✓
          </div>
          <div className="w-8 h-1 bg-green-500 rounded"></div>
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
            ✓
          </div>
          <div className="w-8 h-1 bg-green-500 rounded"></div>
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
            3
          </div>
        </div>

        {/* 用戶資訊摘要 */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${roleInfo.bgColor}`}>
                  <RoleIcon className={`w-6 h-6 ${roleInfo.color}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className={`text-sm ${roleInfo.color}`}>{roleInfo.title}</p>
                </div>
              </div>
              
              {lineUserId && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">LINE 用戶 ID</p>
                  <p className="text-xs font-mono text-gray-800 break-all">{lineUserId}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Google 授權狀態 */}
        {!googleEmail ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    連接 Google 帳號
                  </h3>
                  <p className="text-gray-600 text-sm">
                    授權後即可使用 Google 相關功能
                  </p>
                </div>
              </div>

              {/* 權限說明 */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">此應用程式將可以存取：</p>
                {permissions.map((permission, index) => {
                  const Icon = permission.icon
                  return (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{permission.title}</p>
                        <p className="text-xs text-gray-600">{permission.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                onClick={handleGoogleAuth}
                disabled={isAuthenticating || isGoogleLoading}
                className="w-full h-12 text-lg font-medium bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              >
                {(isAuthenticating || isGoogleLoading) ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>授權中...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>使用 Google 帳號授權</span>
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg bg-green-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-800">Google 帳號已連接</p>
                  <p className="text-sm text-green-600">{googleEmail}</p>
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2 py-4">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-green-700 font-medium">正在完成註冊...</span>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-green-700 font-medium">授權成功！正在自動完成註冊...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 按鈕區域 */}
        {!googleEmail && (
          <div className="flex justify-center">
            <Button
              onClick={onPrev}
              variant="outline"
              className="w-32 h-12 text-lg font-medium border-2"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              上一步
            </Button>
          </div>
        )}

        {/* 安全提示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">隱私保護</p>
              <p>您的個人資料將受到嚴格保護，我們僅會使用必要的資訊來提供服務。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}