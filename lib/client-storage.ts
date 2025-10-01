'use client'

/**
 * 清除所有前端本地儲存資料（localStorage、sessionStorage、IndexedDB、Cache、Cookies）。
 * - IndexedDB：若支援 `indexedDB.databases()` 會嘗試刪除所有資料庫；否則最佳努力。
 * - Cache Storage：刪除所有 cache keys。
 * - Cookies：嘗試刪除目前網域下的 cookies（可能受 path/domain 限制）。
 */
export async function clearAllClientStorage(options?: {
  local?: boolean
  session?: boolean
  indexedDB?: boolean
  caches?: boolean
  cookies?: boolean
}): Promise<void> {
  const cfg = {
    local: true,
    session: true,
    indexedDB: true,
    caches: true,
    cookies: true,
    ...(options || {})
  }

  // localStorage
  try {
    if (cfg.local && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  } catch {}

  // sessionStorage
  try {
    if (cfg.session && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear()
    }
  } catch {}

  // Cache Storage
  try {
    if (cfg.caches && typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys().catch(() => [])
      await Promise.all(keys.map(k => caches.delete(k).catch(() => false)))
    }
  } catch {}

  // IndexedDB
  try {
    if (cfg.indexedDB && typeof window !== 'undefined' && window.indexedDB) {
      const anyIDB: any = window.indexedDB as any
      if (typeof anyIDB.databases === 'function') {
        const dbs: Array<{ name?: string }> = await anyIDB.databases().catch(() => [])
        await Promise.all(
          dbs.map(db => {
            const name = db?.name
            if (!name) return Promise.resolve()
            return new Promise<void>((resolve) => {
              const req = window.indexedDB!.deleteDatabase(name)
              req.onsuccess = () => resolve()
              req.onerror = () => resolve()
              req.onblocked = () => resolve()
            })
          })
        )
      } else {
        // 在 Safari 等不支援 databases() 的環境，無法列舉所有 DB，只能最佳努力：
        // 常見 keyval-store 等（若不存在也不會造成錯誤）
        const candidates = ['keyval-store', 'idb-keyval', 'localforage']
        await Promise.all(
          candidates.map(name => new Promise<void>((resolve) => {
            try {
              const req = window.indexedDB!.deleteDatabase(name)
              req.onsuccess = () => resolve()
              req.onerror = () => resolve()
              req.onblocked = () => resolve()
            } catch {
              resolve()
            }
          }))
        )
      }
    }
  } catch {}

  // Cookies
  try {
    if (cfg.cookies && typeof document !== 'undefined') {
      const cookies = document.cookie ? document.cookie.split(';') : []
      for (const c of cookies) {
        const eqPos = c.indexOf('=')
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim()
        if (!name) continue
        // 嘗試刪除在常見 path 下的 cookie
        const paths = ['/', '/app', '/course-management 2']
        for (const p of paths) {
          try {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}; SameSite=Lax`
          } catch {}
        }
        // 預設路徑再嘗試一次
        try {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
        } catch {}
      }
    }
  } catch {}
}