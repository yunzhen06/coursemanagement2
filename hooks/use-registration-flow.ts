'use client'

import { useState, useEffect } from 'react'
import { useLineAuth } from './use-line-auth'
import { UserService } from '@/services/userService'

export type UserRole = 'teacher' | 'student'

export interface RegistrationData {
  role: UserRole | null
  name: string
  googleEmail: string
  lineUserId: string
}

export interface RegistrationFlowState {
  currentStep: number
  data: RegistrationData
  isCompleted: boolean
  isLoading: boolean
  error: string | null
}

export function useRegistrationFlow() {
  const { user: lineUser, isLoggedIn } = useLineAuth()
  
  const [state, setState] = useState<RegistrationFlowState>({
    currentStep: 1,
    data: {
      role: null,
      name: '',
      googleEmail: '',
      lineUserId: ''
    },
    isCompleted: false,
    isLoading: false,
    error: null
  })

  // 自動設定 LINE User ID
  useEffect(() => {
    if (isLoggedIn && lineUser?.userId) {
      setState(prev => ({
        ...prev,
        data: {
          ...prev.data,
          lineUserId: lineUser.userId
        }
      }))
    }
  }, [isLoggedIn, lineUser])

  const updateData = (updates: Partial<RegistrationData>) => {
    setState(prev => ({
      ...prev,
      data: {
        ...prev.data,
        ...updates
      }
    }))
  }

  const nextStep = () => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 3)
    }))
  }

  const prevStep = () => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1)
    }))
  }

  const goToStep = (step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, Math.min(step, 3))
    }))
  }

  const setError = (error: string | null) => {
    setState(prev => ({
      ...prev,
      error
    }))
  }

  const setLoading = (loading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: loading
    }))
  }

  const completeRegistration = async () => {
    setLoading(true)
    setError(null)

    try {
      // 驗證必要資料
      if (!state.data.role || !state.data.name || !state.data.googleEmail || !state.data.lineUserId) {
        throw new Error('註冊資料不完整')
      }

      // 檢查 LINE User ID 是否已註冊
      const lineUserExists = await UserService.checkLineUserExists(state.data.lineUserId)
      if (lineUserExists) {
        throw new Error('此 LINE 帳號已經註冊過了')
      }

      // 檢查 Google Email 是否已註冊
      const googleEmailExists = await UserService.checkGoogleEmailExists(state.data.googleEmail)
      if (googleEmailExists) {
        throw new Error('此 Google 帳號已經註冊過了')
      }

      // 準備註冊資料
      const registrationPayload = {
        role: state.data.role,
        name: state.data.name,
        googleEmail: state.data.googleEmail,
        lineUserId: state.data.lineUserId,
        registeredAt: new Date().toISOString()
      }

      console.log('註冊資料:', registrationPayload)
      
      // 呼叫註冊 API
      await UserService.registerUser(registrationPayload)
      
      // 發送註冊完成 Flex Message 到 LINE Bot
      try {
        await UserService.sendRegistrationCompleteMessage(
          state.data.lineUserId,
          state.data.name,
          state.data.role
        )
        console.log('註冊完成 Flex Message 發送成功')
      } catch (flexError) {
        console.error('發送 Flex Message 失敗，但註冊已完成:', flexError)
        // 不影響註冊流程，繼續執行
      }
      
      setState(prev => ({
        ...prev,
        isCompleted: true
      }))

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '註冊失敗'
      setError(errorMessage)
      console.error('註冊失敗:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const completeRegistrationWithEmail = async (googleEmail: string) => {
    setLoading(true)
    setError(null)

    try {
      // 驗證必要資料
      if (!state.data.role || !state.data.name || !googleEmail || !state.data.lineUserId) {
        throw new Error('註冊資料不完整')
      }

      // 檢查 LINE User ID 是否已註冊
      const lineUserExists = await UserService.checkLineUserExists(state.data.lineUserId)
      if (lineUserExists) {
        throw new Error('此 LINE 帳號已經註冊過了')
      }

      // 檢查 Google Email 是否已註冊
      const googleEmailExists = await UserService.checkGoogleEmailExists(googleEmail)
      if (googleEmailExists) {
        throw new Error('此 Google 帳號已經註冊過了')
      }

      // 準備註冊資料
      const registrationPayload = {
        role: state.data.role,
        name: state.data.name,
        googleEmail: googleEmail,
        lineUserId: state.data.lineUserId,
        registeredAt: new Date().toISOString()
      }

      console.log('註冊資料:', registrationPayload)
      
      // 呼叫註冊 API
      await UserService.registerUser(registrationPayload)
      
      // 發送註冊完成 Flex Message 到 LINE Bot
      try {
        await UserService.sendRegistrationCompleteMessage(
          state.data.lineUserId,
          state.data.name,
          state.data.role
        )
        console.log('註冊完成 Flex Message 發送成功')
      } catch (flexError) {
        console.error('發送 Flex Message 失敗，但註冊已完成:', flexError)
        // 不影響註冊流程，繼續執行
      }
      
      setState(prev => ({
        ...prev,
        data: {
          ...prev.data,
          googleEmail: googleEmail
        },
        isCompleted: true
      }))

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '註冊失敗'
      setError(errorMessage)
      console.error('註冊失敗:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setState({
      currentStep: 1,
      data: {
        role: null,
        name: '',
        googleEmail: '',
        lineUserId: lineUser?.userId || ''
      },
      isCompleted: false,
      isLoading: false,
      error: null
    })
  }

  const canProceedToNext = () => {
    switch (state.currentStep) {
      case 1:
        return state.data.role !== null
      case 2:
        return state.data.name.trim().length > 0
      case 3:
        return state.data.googleEmail.length > 0
      default:
        return false
    }
  }

  return {
    ...state,
    updateData,
    nextStep,
    prevStep,
    goToStep,
    setError,
    setLoading,
    completeRegistration,
    completeRegistrationWithEmail,
    resetFlow,
    canProceedToNext,
    lineUser
  }
}