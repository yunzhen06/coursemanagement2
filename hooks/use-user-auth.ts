'use client'

import { useState, useEffect } from 'react'
import { useLineAuth } from './use-line-auth'
import { UserService, UserProfile } from '@/services/userService'

export interface UserAuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  isLoading: boolean
  error: string | null
  needsRegistration: boolean
}

export function useUserAuth() {
  const { isLoggedIn, user: userProfile, isLoading: lineLoading } = useLineAuth()
  const [authState, setAuthState] = useState<UserAuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
    needsRegistration: false
  })

  // 檢查用戶是否已註冊
  const checkUserRegistration = async (lineUserId: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

      const user = await UserService.getUserByLineId(lineUserId)
      
      if (user) {
        // 用戶已註冊，記錄登入
        await UserService.recordLogin(lineUserId)
        
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
          error: null,
          needsRegistration: false
        })
      } else {
        // 用戶未註冊，需要進行註冊流程
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
          needsRegistration: true
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '檢查用戶狀態失敗'
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: errorMessage,
        needsRegistration: false
      })
    }
  }

  // 重新檢查用戶狀態
  const refreshUserAuth = async () => {
    if (userProfile?.userId) {
      await checkUserRegistration(userProfile.userId)
    }
  }

  // 登出用戶
  const logout = () => {
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      needsRegistration: false
    })
  }

  // 當 LINE 登入狀態改變時檢查用戶註冊狀態
  useEffect(() => {
    if (lineLoading) {
      setAuthState(prev => ({ ...prev, isLoading: true }))
      return
    }

    if (!isLoggedIn || !userProfile?.userId) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        needsRegistration: false
      })
      return
    }

    checkUserRegistration(userProfile.userId)
  }, [isLoggedIn, userProfile?.userId, lineLoading])

  return {
    ...authState,
    refreshUserAuth,
    logout,
    lineProfile: userProfile
  }
}