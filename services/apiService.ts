const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v2'
const DEFAULT_GUEST_LINE_USER_ID = 'guest-8f5eb095-81a8-4fec-b0ca-172ac37e202f'

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
  details?: any
}

export class ApiService {
  private static lineUserId: string = DEFAULT_GUEST_LINE_USER_ID
  static get backendOrigin() {
    try { return new URL(API_BASE_URL).origin } catch { return '' }
  }

  static setLineUserId(userId: string) {
    // 強制使用可用的 guest ID 以避免 403（後端 web_* 端點需要存在用戶）
    if (typeof userId === 'string' && userId.startsWith('guest-')) {
      this.lineUserId = userId
    } else {
      this.lineUserId = DEFAULT_GUEST_LINE_USER_ID
    }
  }

  private static ensureLineUserId(): string {
    if (this.lineUserId && this.lineUserId.startsWith('guest-')) return this.lineUserId
    return this.bootstrapLineUserId()
  }

  static getLineUserId() {
    return this.lineUserId
  }

  // 訪客模式：在瀏覽器產生並保存 guest lineUserId
  static bootstrapLineUserId(): string {
    if (typeof window === 'undefined') return this.lineUserId || ''
    try {
      const KEY = 'lineUserId'
      let id = localStorage.getItem(KEY) || ''
      if (!id) {
        // 使用指定的預設訪客 ID，若未來需要可改為亂數
        id = DEFAULT_GUEST_LINE_USER_ID
        localStorage.setItem(KEY, id)
      }
      this.setLineUserId(id)
      return id
    } catch {
      // 無法使用 localStorage 時，回退為臨時 ID（不持久化）
      const temp = this.lineUserId || DEFAULT_GUEST_LINE_USER_ID
      this.setLineUserId(temp)
      return temp
    }
  }

  private static async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
      const baseHeaders: Record<string, any> = {
        'X-Line-User-Id': this.lineUserId,
        ...(options.headers || {}),
      }
      if (!isFormData) {
        baseHeaders['Content-Type'] = 'application/json'
      }

      // 如果 API_BASE_URL 包含 ngrok-free.app，添加 ngrok-skip-browser-warning header
      if (API_BASE_URL.includes('ngrok-free.app')) {
        baseHeaders['ngrok-skip-browser-warning'] = 'true'
      }

      const fullUrl = `${API_BASE_URL}${endpoint}`
      console.log(`[API] Making request to: ${fullUrl}`)
      
      const response = await fetch(fullUrl, {
        ...options,
        headers: baseHeaders,
        // 避免瀏覽器層快取舊資料
        cache: 'no-store'
      })

      if (!response.ok) {
        // 後端可能回傳非 JSON 錯誤或空 body
        const errText = await response.text().catch(() => '')
        let errJson: any = {}
        try { errJson = errText ? JSON.parse(errText) : {} } catch { errJson = {} }
        return {
          error: errJson.message || `HTTP ${response.status}`,
          details: errJson || errText
        }
      }

      // 處理 204 或空 body
      const contentType = response.headers.get('content-type') || ''
      if (response.status === 204) {
        return { data: null as any }
      }
      const raw = await response.text()
      if (!raw) {
        return { data: null as any }
      }
      if (!contentType.includes('application/json')) {
        return { data: raw as any }
      }
      const data = JSON.parse(raw)
      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '網路錯誤'
      }
    }
  }

  // 用戶相關 API
  static async getProfile(lineUserId: string) {
    return this.request(`/profile/${lineUserId}/`)
  }

  static async updateProfile(lineUserId: string, data: any) {
    return this.request(`/profile/${lineUserId}/`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  // 課程相關 API
  static async getCourses(lineUserId: string) {
    this.setLineUserId(lineUserId)
    const effective = this.ensureLineUserId()
    const qs = `?${new URLSearchParams({ line_user_id: effective, _ts: String(Date.now()) }).toString()}`
    const resp = await this.request<any>(`/web/courses/list/${qs}`)
    if (resp?.error) return resp
    const courses = resp?.data?.data?.courses ?? []
    return { data: courses }
  }

  static async createCourse(data: any) {
    // 確保有可用的 lineUserId，並放入 body 以通過後端驗證
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const payload = { line_user_id: this.lineUserId, ...data }
    const resp = await this.request<any>('/web/courses/create/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (resp?.error) return resp
    // 後端 web_* 多半回傳 { success, data } 格式，這裡攤平成 data
    const entity = (resp as any)?.data?.data || (resp as any)?.data
    return { data: entity }
  }

  static async updateCourse(courseId: string, data: any) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const payload = { line_user_id: this.lineUserId, course_id: courseId, ...data }
    const resp = await this.request<any>('/web/courses/update/', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
    if (resp?.error) return resp
    const entity = (resp as any)?.data?.data || (resp as any)?.data
    return { data: entity }
  }

  static async deleteCourse(courseId: string) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const payload = { line_user_id: this.lineUserId, course_id: courseId }
    return this.request('/web/courses/delete/', {
      method: 'DELETE',
      body: JSON.stringify(payload)
    })
  }

  // 作業相關 API
  static async getAssignments(lineUserId: string) {
    this.setLineUserId(lineUserId)
    const effective = this.ensureLineUserId()
    const qs = `?${new URLSearchParams({ line_user_id: effective, _ts: String(Date.now()) }).toString()}`
    const resp = await this.request<any>(`/web/assignments/list/${qs}`)
    if (resp?.error) return resp
    const assignments = resp?.data?.data?.assignments ?? []
    return { data: assignments }
  }

  static async createAssignment(data: any) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    // 轉換前端鍵名到後端需求
    const payload: any = { line_user_id: this.lineUserId, ...data }
    if (payload.course) {
      payload.course_id = payload.course
      delete payload.course
    }
    const resp = await this.request<any>('/web/assignments/create/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (resp?.error) return resp
    const entity = (resp as any)?.data?.data || (resp as any)?.data
    return { data: entity }
  }

  static async updateAssignment(assignmentId: string, data: any) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const payload: any = { line_user_id: this.lineUserId, assignment_id: assignmentId, ...data }
    if (payload.course) {
      payload.course_id = payload.course
      delete payload.course
    }
    const resp = await this.request<any>('/web/assignments/update/', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
    if (resp?.error) return resp
    const entity = (resp as any)?.data?.data || (resp as any)?.data
    return { data: entity }
  }

  static async updateAssignmentStatus(assignmentId: string, status: 'pending' | 'completed' | 'overdue', retryCount = 0): Promise<ApiResponse<any>> {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    console.log('API: 更新作業狀態', { assignmentId, status, lineUserId: this.lineUserId, retryCount })
    
    const payload = { status, line_user_id: this.lineUserId }
    
    try {
      const response = await this.request(`/assignments/${assignmentId}/status/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      console.log('API: 更新作業狀態響應', response)
      
      // 如果API調用成功但沒有返回完整資料，記錄警告
      if (!response.error && response.data) {
        const data = response.data as any
        const hasRequiredFields = data.id && data.title
        if (!hasRequiredFields) {
          console.warn('API返回的作業資料不完整:', response.data)
        }
      }
      
      return response
      
    } catch (error) {
      // 網路錯誤時重試
      if (retryCount < 2 && (error instanceof Error && error.message.includes('網路錯誤'))) {
        console.log(`API調用失敗，進行第 ${retryCount + 1} 次重試`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // 遞增延遲
        return this.updateAssignmentStatus(assignmentId, status, retryCount + 1)
      }
      
      throw error
    }
  }

  static async deleteAssignment(assignmentId: string) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const payload = { line_user_id: this.lineUserId, assignment_id: assignmentId }
    return this.request('/web/assignments/delete/', {
      method: 'DELETE',
      body: JSON.stringify(payload)
    })
  }

  static async getAssignmentRecommendations(assignmentId: string, options?: { limit?: number; perSource?: number; q?: string }) {
    const limit = options?.limit
    const perSource = options?.perSource
    const q = options?.q
    const qs = new URLSearchParams()
    if (typeof limit === 'number') qs.set('limit', String(limit))
    if (typeof perSource === 'number') qs.set('per_source', String(perSource))
    if (typeof q === 'string' && q.trim()) qs.set('q', q.trim())
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<{
      assignment: string
      query: string
      results: Array<{ source: string; url: string; title: string; snippet?: string; score?: number }>
      meta?: { sources?: Record<string, number> }
    }>(`/assignments/${assignmentId}/recommendations${suffix}`)
  }

  // 筆記相關 API
  static async getNotes(lineUserId: string) {
    this.setLineUserId(lineUserId)
    const effective = this.ensureLineUserId()
    const qs = `?${new URLSearchParams({ line_user_id: effective, _ts: String(Date.now()) }).toString()}`
    return this.request(`/notes/${qs}`)
  }

  static async createNote(data: any) {
    return this.request('/notes/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  static async updateNote(noteId: string, data: any) {
    return this.request(`/notes/${noteId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  static async deleteNote(noteId: string) {
    return this.request(`/notes/${noteId}/`, {
      method: 'DELETE'
    })
  }

  // 考試相關 API
  static async getExams(lineUserId: string) {
    this.setLineUserId(lineUserId)
    const effective = this.ensureLineUserId()
    const qs = `?${new URLSearchParams({ line_user_id: effective, _ts: String(Date.now()) }).toString()}`
    return this.request(`/exams/${qs}`)
  }

  static async createExam(data: any) {
    return this.request('/exams/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  static async updateExam(examId: string, data: any) {
    return this.request(`/exams/${examId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  static async updateExamStatus(examId: string, status: 'pending' | 'completed' | 'overdue') {
    return this.request(`/exams/${examId}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status })
    })
  }

  static async deleteExam(examId: string) {
    return this.request(`/exams/${examId}/`, {
      method: 'DELETE'
    })
  }

  static async getExamRecommendations(examId: string, options?: { limit?: number; perSource?: number; q?: string }) {
    const limit = options?.limit
    const perSource = options?.perSource
    const q = options?.q
    const qs = new URLSearchParams()
    if (typeof limit === 'number') qs.set('limit', String(limit))
    if (typeof perSource === 'number') qs.set('per_source', String(perSource))
    if (typeof q === 'string' && q.trim()) qs.set('q', q.trim())
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<{
      exam: string
      query: string
      results: Array<{ source: string; url: string; title: string; snippet?: string; score?: number }>
      meta?: { sources?: Record<string, number> }
    }>(`/exams/${examId}/recommendations${suffix}`)
  }

  // 檔案相關 API
  static async uploadFile(file: File, extra?: { noteId?: string; courseId?: string; assignmentId?: string; examId?: string }) {
    // 確保 lineUserId 已初始化
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }

    const formData = new FormData()
    formData.append('file', file)
    if (extra?.noteId) formData.append('noteId', extra.noteId)
    if (extra?.courseId) formData.append('courseId', extra.courseId)
    if (extra?.assignmentId) formData.append('assignmentId', extra.assignmentId)
    if (extra?.examId) formData.append('examId', extra.examId)

    return this.request('/files/', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Line-User-Id': this.lineUserId,
        // 不設定 Content-Type，讓瀏覽器自動設定 multipart/form-data
      }
    })
  }

  static async getFile(fileId: string) {
    return this.request(`/files/${fileId}/`)
  }

  static async deleteFile(fileId: string) {
    return this.request(`/files/${fileId}/`, {
      method: 'DELETE'
    })
  }

  // 自訂分類 API
  static async getCustomCategories(lineUserId: string) {
    this.setLineUserId(lineUserId)
    const effective = this.ensureLineUserId()
    const qs = `?${new URLSearchParams({ line_user_id: effective }).toString()}`
    return this.request(`/custom-categories/${qs}`)
  }

  static async createCustomCategory(data: { name: string; icon?: string; color?: string }) {
    return this.request('/custom-categories/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  static async updateCustomCategory(id: string, data: Partial<{ name: string; icon: string; color: string }>) {
    return this.request(`/custom-categories/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  static async deleteCustomCategory(id: string) {
    return this.request(`/custom-categories/${id}/`, {
      method: 'DELETE'
    })
  }

  // 自訂待辦 API
  static async getCustomTodos(lineUserId: string, params?: Record<string, string>) {
    this.setLineUserId(lineUserId)
    const effective = this.ensureLineUserId()
    const merged = new URLSearchParams({ line_user_id: effective, ...(params || {}) })
    const query = `?${merged.toString()}`
    return this.request(`/custom-todos/${query}`)
  }

  static async createCustomTodo(data: {
    category?: string | null
    course?: string | null
    title: string
    description?: string
    due_date: string
    status?: 'pending' | 'completed' | 'overdue'
  }) {
    return this.request('/custom-todos/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  static async updateCustomTodo(id: string, data: Partial<{ title: string; description: string; due_date: string; status: 'pending' | 'completed' | 'overdue'; category: string | null; course: string | null }>, retryCount = 0): Promise<ApiResponse<any>> {
    // 確保有可用的 lineUserId
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    console.log('API: 更新待辦事項', { id, data, lineUserId: this.lineUserId, retryCount })
    
    try {
      const response = await this.request(`/custom-todos/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: {
          'X-Line-User-Id': this.lineUserId,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('API: 更新待辦事項響應', response)
      return response
      
    } catch (error) {
      // 網路錯誤時重試
      if (retryCount < 2 && (error instanceof Error && error.message.includes('網路錯誤'))) {
        console.log(`API調用失敗，進行第 ${retryCount + 1} 次重試`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // 遞增延遲
        return this.updateCustomTodo(id, data, retryCount + 1)
      }
      
      throw error
    }
  }

  static async deleteCustomTodo(id: string) {
    // 確保有可用的 lineUserId
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    console.log('API: 刪除待辦事項', { id, lineUserId: this.lineUserId })
    
    const response = await this.request(`/custom-todos/${id}/`, {
      method: 'DELETE',
      headers: {
        'X-Line-User-Id': this.lineUserId,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('API: 刪除待辦事項響應', response)
    return response
  }

  // 批量匯入課程
  static async importCourses(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    
    return this.request('/files/import_courses/', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Line-User-Id': this.lineUserId,
        // 不設定 Content-Type，讓瀏覽器自動設定 multipart/form-data
      }
    })
  }

  // 課表圖片 OCR 匯入（Gemini/Gemma 後端）
  static async importTimetableImage(image: File, options?: { preview?: boolean; dryRun?: boolean }) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const formData = new FormData()
    // 嘗試兩個欄位名以相容後端實作
    formData.append('file', image)
    formData.append('image', image)
    
    // 添加選項參數
    if (options?.preview) {
      formData.append('preview', 'true')
    }
    if (options?.dryRun) {
      formData.append('dryRun', 'true')
    }
    
    return this.request('/files/import-timetable-image/', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Line-User-Id': this.lineUserId,
      }
    })
  }

  // OCR 預覽模式 - 獲取解析結果和衝突檢查
  static async previewTimetableImage(image: File) {
    return this.importTimetableImage(image, { preview: true })
  }

  // OCR 確認創建 - 使用編輯後的課程數據創建課程
  static async confirmTimetableImport(courses: any[]) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    return this.request('/files/confirm-timetable-import/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-User-Id': this.lineUserId,
      },
      body: JSON.stringify({ courses })
    })
  }

  // OCR 預覽方法別名 - 與前端調用保持一致
  static async ocrSchedulePreview(image: File) {
    return this.previewTimetableImage(image)
  }

  // OCR 確認方法別名 - 與前端調用保持一致
  static async ocrScheduleConfirm(courses: any[]) {
    return this.confirmTimetableImport(courses)
  }

  // 課程時間設定（web）
  static async setCourseSchedule(courseId: string, schedules: Array<{ day_of_week: number; start_time: string; end_time: string; location?: string }>) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    const payload = {
      line_user_id: this.lineUserId,
      course_id: courseId,
      schedules
    }
    return this.request('/web/courses/schedule/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }



  // AI 筆記摘要
  static async getNoteAiSummary(noteId: string) {
    return this.request(`/notes/${noteId}/ai/summary/`, {
      method: 'POST'
    })
  }

  // Google Classroom 同步相關 API
  static async syncGoogleClassroom() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request('/sync/classroom-to-v2/', {
      method: 'POST',
      body: JSON.stringify({ line_user_id: this.lineUserId })
    })
  }

  static async syncGoogleClassroomCourse(courseId: string) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request('/sync/classroom-course/', {
      method: 'POST',
      body: JSON.stringify({ 
        line_user_id: this.lineUserId,
        google_course_id: courseId 
      })
    })
  }

  static async getGoogleSyncStatus() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request(`/sync/status/?line_user_id=${this.lineUserId}`, {
      method: 'GET'
    })
  }

  static async getGoogleApiStatus() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request(`/sync/google-status/?line_user_id=${this.lineUserId}`, {
      method: 'GET'
    })
  }

  static async testGoogleConnection() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request('/sync/test-connection/', {
      method: 'POST',
      body: JSON.stringify({ line_user_id: this.lineUserId })
    })
  }

  static async triggerAutoSync() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request('/sync/auto-trigger/', {
      method: 'POST',
      body: JSON.stringify({ line_user_id: this.lineUserId })
    })
  }

  static async manualSyncAll() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    return this.request('/sync/manual-sync-all/', {
      method: 'POST',
      body: JSON.stringify({ line_user_id: this.lineUserId })
    })
  }

  // Google OAuth 相關 API
  static async getGoogleOAuthUrl() {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Line-User-Id': this.lineUserId,
    }
    
    // 如果 API_BASE_URL 包含 ngrok-free.app，添加 ngrok-skip-browser-warning header
    if (API_BASE_URL.includes('ngrok-free.app')) {
      headers['ngrok-skip-browser-warning'] = 'true'
    }
    
    const response = await fetch(`${API_BASE_URL.replace('/api/v2', '')}/api/oauth/google/url/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ line_user_id: this.lineUserId }),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to get Google OAuth URL')
    }
    
    return response.json()
  }

  // Google Calendar 相關 API
  static async getCalendarEvents(params?: {
    calendar_id?: string
    time_min?: string
    time_max?: string
    max_results?: number
  }) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    const queryParams = new URLSearchParams({
      line_user_id: this.lineUserId,
      calendar_id: params?.calendar_id || 'primary',
      ...(params?.time_min && { time_min: params.time_min }),
      ...(params?.time_max && { time_max: params.time_max }),
      ...(params?.max_results && { max_results: params.max_results.toString() })
    })
    
    return this.request(`/calendar/get_calendar_events/?${queryParams}`, {
      method: 'GET'
    })
  }

  static async createCalendarEvent(data: {
    calendar_id?: string
    summary: string
    description?: string
    start_datetime: string
    end_datetime: string
    location?: string
    attendees?: string[]
  }) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    return this.request('/calendar/create_calendar_event/', {
      method: 'POST',
      body: JSON.stringify({
        line_user_id: this.lineUserId,
        calendar_id: data.calendar_id || 'primary',
        ...data
      })
    })
  }

  static async updateCalendarEvent(data: {
    calendar_id?: string
    event_id: string
    summary?: string
    description?: string
    start_datetime?: string
    end_datetime?: string
    location?: string
    attendees?: string[]
  }) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    return this.request('/calendar/update_calendar_event/', {
      method: 'PATCH',
      body: JSON.stringify({
        line_user_id: this.lineUserId,
        calendar_id: data.calendar_id || 'primary',
        ...data
      })
    })
  }

  static async deleteCalendarEvent(data: {
    calendar_id?: string
    event_id: string
  }) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    return this.request('/calendar/delete_calendar_event/', {
      method: 'DELETE',
      body: JSON.stringify({
        line_user_id: this.lineUserId,
        calendar_id: data.calendar_id || 'primary',
        event_id: data.event_id
      })
    })
  }

  static async manageCalendarAttendees(data: {
    calendar_id?: string
    event_id: string
    attendees?: string[]
    attendees_to_remove?: string[]
  }) {
    if (!this.lineUserId) {
      this.bootstrapLineUserId()
    }
    
    return this.request('/calendar/events/attendees/', {
      method: 'POST',
      body: JSON.stringify({
        line_user_id: this.lineUserId,
        calendar_id: data.calendar_id || 'primary',
        ...data
      })
    })
  }


}
