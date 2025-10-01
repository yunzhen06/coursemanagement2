'use client'

import { DebugRegistration } from '@/components/debug-registration'

export default function DebugRegistrationPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">註冊問題診斷</h1>
        <DebugRegistration />
      </div>
    </div>
  )
}