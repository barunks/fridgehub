import type {
  AssistantInsight,
  AuditLogEntry,
  DeviceInfo,
  FamilyHubState,
  FrequencyType,
  GroceryItemUpdateInput,
  GroceryItem,
  GroceryType,
  MealPlanItem,
  NewGroceryItemInput,
  NewShoppingItemInput,
  NewTaskInput,
  Notification,
  Permission,
  Recipe,
  ShoppingCycleItem,
  ShoppingItemUpdateInput,
  Task,
} from '@/types/familyHub'

const defaultBaseUrl =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : ''
const configuredBaseUrl = import.meta.env.VITE_API_URL || defaultBaseUrl
const apiBaseUrl = configuredBaseUrl.endsWith('/') ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl

const apiUrl = (path: string) => {
  if (apiBaseUrl.endsWith('/api') && path.startsWith('/api/')) {
    return `${apiBaseUrl}${path.slice('/api'.length)}`
  }
  return `${apiBaseUrl}${path}`
}

interface TokenResponse {
  accessToken: string
  refreshToken?: string
  tokenType: string
}

let accessToken: string | null = null

export interface AccessTokenPayload {
  sub?: string
  username?: string
  role?: string
  permissions?: Permission[]
  family_id?: number
  device_id?: string
  exp?: number
}

const DEVICE_ID_KEY = 'familyhub-device-id'

const computeDeviceFingerprint = async (): Promise<string> => {
  const components = [
    navigator.platform || '',
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    navigator.hardwareConcurrency || 0,
    (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.maxTouchPoints || 0,
    navigator.languages?.join(',') || navigator.language || '',
  ]
  // GPU renderer adds strong uniqueness per physical device
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl && gl instanceof WebGLRenderingContext) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        components.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      }
    }
  } catch { /* GPU info unavailable */ }

  const raw = components.join('|')
  const encoded = new TextEncoder().encode(raw)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  const bytes = new Uint8Array(hash)
  return Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const getDeviceId = async (): Promise<string> => {
  if (typeof window === 'undefined') return 'server'
  const cached = window.localStorage.getItem(DEVICE_ID_KEY)
  if (cached) return cached
  const fingerprint = await computeDeviceFingerprint()
  window.localStorage.setItem(DEVICE_ID_KEY, fingerprint)
  return fingerprint
}

const getDeviceName = (): string => {
  if (typeof window === 'undefined') return 'server'
  const ua = navigator.userAgent
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android.*Mobile/i.test(ua)) return 'Android Phone'
  if (/Android/i.test(ua)) return 'Android Tablet'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows PC'
  if (/Linux/i.test(ua)) return 'Linux PC'
  return 'Browser'
}

export const parseAccessToken = (token: string | null = accessToken): AccessTokenPayload | null => {
  if (!token) return null
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(window.atob(padded)) as AccessTokenPayload
  } catch {
    return null
  }
}

export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const getAccessToken = () => accessToken

export const clearAccessToken = () => {
  accessToken = null
}

const authRequired = () => {
  clearAccessToken()
  window.dispatchEvent(new Event('familyhub:auth-required'))
  throw new Error('AUTH_REQUIRED')
}

const readError = async (response: Response) => {
  const body = await response.json().catch(() => null)
  const validationMessage = Array.isArray(body?.validationErrors)
    ? body.validationErrors.map((item: { field?: string; message?: string }) => `${item.field || 'field'}: ${item.message || 'invalid'}`).join(', ')
    : null
  return body?.error?.detail || body?.detail || validationMessage || response.statusText || 'Request failed'
}

export const loginUser = async (username: string, password: string) => {
  const response = await fetch(apiUrl('/api/v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password, deviceId: await getDeviceId(), deviceName: getDeviceName() }),
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  const tokens = (await response.json()) as TokenResponse
  setAccessToken(tokens.accessToken)
  return tokens
}

export const refreshAccessToken = async () => {
  const response = await fetch(apiUrl('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  if (!response.ok) {
    return authRequired()
  }
  const tokens = (await response.json()) as TokenResponse
  setAccessToken(tokens.accessToken)
  return tokens.accessToken
}

export const logoutUser = async () => {
  const token = accessToken
  await fetch(apiUrl('/api/v1/auth/logout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  }).catch(() => undefined)
  clearAccessToken()
}

const accessTokenOrRefresh = async () => {
  return accessToken || refreshAccessToken()
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = await accessTokenOrRefresh()
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })

  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken()
    headers.set('Authorization', `Bearer ${refreshedToken}`)
    const retry = await fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers,
    })
    if (!retry.ok) {
      if (retry.status === 401) return authRequired()
      throw new Error(await readError(retry))
    }
    if (retry.status === 204) return undefined as T
    return retry.json() as Promise<T>
  }

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const queryString = (params: Record<string, string | number | boolean | null | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}

export const api = {
  loginUser,
  logoutUser,
  refreshAccessToken,
  getAccessToken,
  parseAccessToken,
  bootstrap: () => request<FamilyHubState>('/api/v1/family/bootstrap'),
  listGroceryItems: (params: { limit?: number; offset?: number; listTypeId?: number | 'all' } = {}) =>
    request<GroceryItem[]>(
      `/api/v1/grocery/items${queryString({
        limit: params.limit,
        offset: params.offset,
        list_type_id: params.listTypeId === 'all' ? undefined : params.listTypeId,
      })}`,
    ),
  listTasks: (params: { limit?: number; offset?: number; status?: string | 'all' } = {}) =>
    request<Task[]>(
      `/api/v1/tasks${queryString({
        limit: params.limit,
        offset: params.offset,
        status: params.status === 'all' ? undefined : params.status,
      })}`,
    ),
  listRecipes: (params: { limit?: number; offset?: number } = {}) =>
    request<Recipe[]>(`/api/v1/meal-plan/recipes${queryString(params)}`),
  listNotifications: (params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) =>
    request<Notification[]>(
      `/api/v1/notifications${queryString({
        limit: params.limit,
        offset: params.offset,
        unread_only: params.unreadOnly,
      })}`,
    ),
  listAuditLogs: (params: { limit?: number; offset?: number; entityType?: string } = {}) =>
    request<AuditLogEntry[]>(
      `/api/v1/family/audit-logs${queryString({
        limit: params.limit,
        offset: params.offset,
        entity_type: params.entityType,
      })}`,
    ),
  getAssistantInsights: () => request<AssistantInsight[]>('/api/v1/assistant/insights'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  createGroceryItem: (payload: NewGroceryItemInput) =>
    request('/api/v1/grocery/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateGroceryItem: (itemId: number, payload: GroceryItemUpdateInput) =>
    request<GroceryItem>(`/api/v1/grocery/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  listShoppingItems: (params: { listTypeId?: number | 'all' } = {}) =>
    request<ShoppingCycleItem[]>(
      `/api/v1/grocery/shopping-items${queryString({
        list_type_id: params.listTypeId === 'all' ? undefined : params.listTypeId,
      })}`,
    ),
  buildShoppingList: () =>
    request<ShoppingCycleItem[]>('/api/v1/grocery/shopping-items/build', {
      method: 'POST',
    }),
  createShoppingItem: (payload: NewShoppingItemInput) =>
    request<ShoppingCycleItem>('/api/v1/grocery/shopping-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateShoppingItem: (subItemId: number, payload: ShoppingItemUpdateInput) =>
    request<ShoppingCycleItem>(`/api/v1/grocery/shopping-items/${subItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  regenerateGroceryCycles: () =>
    request('/api/v1/grocery/regenerate-cycles', {
      method: 'POST',
    }),
  createListType: (listName: string, description: string, colorClass: string) =>
    request('/api/v1/grocery/list-types', {
      method: 'POST',
      body: JSON.stringify({ listName, description, colorClass }),
    }),
  deleteListType: (listTypeId: number) =>
    request(`/api/v1/grocery/list-types/${listTypeId}`, {
      method: 'DELETE',
    }),
  createTask: (payload: NewTaskInput) =>
    request('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        category: payload.category,
        priority: payload.priority,
        dueAt: payload.dueAt,
        reminderAt: payload.reminderAt,
        assignedTo: payload.assignedTo,
        recurrenceType: payload.recurrenceType || 'none',
      }),
    }),
  updateTask: (taskId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateMeal: (mealId: number, mealName: string) =>
    request(`/api/v1/meal-plan/${mealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ mealName }),
    }),
  getWeeklyMeals: (memberId?: number | null) =>
    request<MealPlanItem[]>(`/api/v1/meal-plan/week${queryString({ member_id: memberId })}`),
  applyMealTemplate: (memberId?: number | null) =>
    request('/api/v1/meal-plan/apply-template', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),
  applyMealTemplateAll: () =>
    request('/api/v1/meal-plan/apply-template', {
      method: 'POST',
      body: JSON.stringify({ allMembers: true }),
    }),
  markNotificationRead: (notificationId: number) =>
    request(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),
  markAllNotificationsRead: () =>
    request<{ marked: number }>('/api/v1/notifications/mark-all-read', {
      method: 'POST',
    }),
  createAnnouncement: (title: string, message: string) =>
    request('/api/v1/family/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, message, ownerId: 1, tag: 'family' }),
    }),
  createMember: (payload: { name: string; email: string; username: string; password: string; role: string; colorClass: string }) =>
    request('/api/v1/family/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (memberId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/family/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteMember: (memberId: number) =>
    request(`/api/v1/family/members/${memberId}`, { method: 'DELETE' }),
  createEmergencyContact: (label: string, value: string) =>
    request('/api/v1/family/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify({ label, value }),
    }),
  updateEmergencyContact: (contactId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/family/emergency-contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteEmergencyContact: (contactId: number) =>
    request(`/api/v1/family/emergency-contacts/${contactId}`, { method: 'DELETE' }),
  deleteAnnouncement: (announcementId: number) =>
    request(`/api/v1/family/announcements/${announcementId}`, { method: 'DELETE' }),
  deleteTask: (taskId: number) =>
    request(`/api/v1/tasks/${taskId}`, { method: 'DELETE' }),
  deleteGroceryItem: (itemId: number) =>
    request(`/api/v1/grocery/items/${itemId}`, { method: 'DELETE' }),
  updateListType: (listTypeId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/grocery/list-types/${listTypeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  listGroceryTypes: () => request<GroceryType[]>('/api/v1/grocery/types'),
  createGroceryType: (payload: { typeName: string; description?: string; icon?: string; color?: string }) =>
    request('/api/v1/grocery/types', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateGroceryType: (typeId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/grocery/types/${typeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteGroceryType: (typeId: number) =>
    request(`/api/v1/grocery/types/${typeId}`, { method: 'DELETE' }),
  listFrequencyTypes: () => request<FrequencyType[]>('/api/v1/grocery/frequency-types'),
  downloadShoppingReport: async (params: {
    listTypeId?: number | 'all'
    frequency?: string | 'all'
    stock?: string | 'all'
    itemName?: string | 'all'
    onlyNeeded?: boolean
  } = {}) => {
    const token = await accessTokenOrRefresh()
    const search = new URLSearchParams()
    if (params.listTypeId && params.listTypeId !== 'all') search.set('list_type_id', String(params.listTypeId))
    if (params.frequency && params.frequency !== 'all') search.set('frequency', params.frequency)
    if (params.stock && params.stock !== 'all') search.set('stock', params.stock)
    if (params.itemName && params.itemName !== 'all') search.set('item_name', params.itemName)
    if (params.onlyNeeded) search.set('only_needed', 'true')
    const qs = search.toString() ? `?${search.toString()}` : ''
    const response = await fetch(apiUrl(`/api/v1/grocery/shopping-report${qs}`), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
    if (!response.ok) throw new Error(await readError(response))
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shopping-report.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
  // Device management
  listDevices: () => request<DeviceInfo[]>('/api/v1/auth/devices'),
  updateDevice: (deviceId: number, payload: { deviceName?: string; isTrusted?: boolean }) =>
    request<DeviceInfo>(`/api/v1/auth/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  revokeDevice: (deviceId: number) =>
    request(`/api/v1/auth/devices/${deviceId}`, { method: 'DELETE' }),
  revokeDeviceSessions: (deviceId: number) =>
    request<{ revoked: number }>(`/api/v1/auth/devices/${deviceId}/revoke-sessions`, { method: 'POST' }),
  createRecipe: (payload: Record<string, unknown>) =>
    request('/api/v1/meal-plan/recipes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRecipe: (recipeId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/meal-plan/recipes/${recipeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteRecipe: (recipeId: number) =>
    request(`/api/v1/meal-plan/recipes/${recipeId}`, { method: 'DELETE' }),
  askAssistant: (query: string) =>
    request<{ answer: string; insights: AssistantInsight[] }>('/api/v1/assistant/recommendations', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
}
