"use client"

import { useState, useEffect, useCallback } from "react"
import { ApiService } from "@/services/apiService"

export interface CustomCategory {
  id: string
  name: string
  icon: string
  color: string
  createdAt: Date
}

export function useCustomCategories(lineUserId: string) {
  const [categories, setCategories] = useState<CustomCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 載入分類資料（優先走後端，失敗時退回 localStorage）
  const fetchCategories = useCallback(async () => {
    if (!lineUserId) return

    try {
      setIsLoading(true)
      setError(null)

      // 後端 API 優先
      const resp = await ApiService.getCustomCategories(lineUserId)
      const raw = (resp.data as any)?.results || (resp.data as any) || []
      if (Array.isArray(raw)) {
        const categories = raw.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || 'clipboard',
          color: cat.color || '#3b82f6',
          createdAt: new Date(cat.created_at),
        }))
        setCategories(categories)
        return
      }

      // 退回 localStorage 作為備援
      const stored = localStorage.getItem('customCategories')
      if (stored) {
        const parsed = JSON.parse(stored)
        const categoriesWithDates = parsed.map((cat: any) => ({
          ...cat,
          createdAt: new Date(cat.createdAt),
        }))
        setCategories(categoriesWithDates)
      } else {
        setCategories([])
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '載入自定義分類失敗')
    } finally {
      setIsLoading(false)
    }
  }, [lineUserId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // 儲存分類到 localStorage（暫時方案）
  const saveCategories = (newCategories: CustomCategory[]) => {
    setCategories(newCategories)
    localStorage.setItem("customCategories", JSON.stringify(newCategories))
  }

  const addCategory = useCallback(async (category: Omit<CustomCategory, "id" | "createdAt">) => {
    try {
      // 後端優先
      const resp = await ApiService.createCustomCategory({ name: category.name, icon: category.icon, color: category.color })
      if (resp.data) {
        const created: CustomCategory = {
          id: (resp.data as any).id,
          name: (resp.data as any).name,
          icon: (resp.data as any).icon || 'clipboard',
          color: (resp.data as any).color || '#3b82f6',
          createdAt: new Date((resp.data as any).created_at),
        }
        setCategories((prev) => [...prev, created])
        return created
      }

      // 後備：localStorage
      const newCategory: CustomCategory = {
        ...category,
        id: Date.now().toString(),
        createdAt: new Date(),
      }
      const updatedCategories = [...categories, newCategory]
      saveCategories(updatedCategories)
      return newCategory
    } catch (err) {
      throw err
    }
  }, [categories])

  const updateCategory = useCallback(async (id: string, updates: Partial<Omit<CustomCategory, "id" | "createdAt">>) => {
    try {
      const resp = await ApiService.updateCustomCategory(id, updates)
      if (resp.error) throw new Error(resp.error)

      const updatedCategories = categories.map((cat) => 
        cat.id === id ? { ...cat, ...updates } : cat
      )
      saveCategories(updatedCategories)
    } catch (err) {
      throw err
    }
  }, [categories])

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const resp = await ApiService.deleteCustomCategory(id)
      if (resp.error) throw new Error(resp.error)
      const updatedCategories = categories.filter((cat) => cat.id !== id)
      saveCategories(updatedCategories)
    } catch (err) {
      throw err
    }
  }, [categories])

  const getCategoryById = (id: string) => {
    return categories.find((cat) => cat.id === id)
  }

  return {
    categories,
    isLoading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    refetch: fetchCategories
  }
}