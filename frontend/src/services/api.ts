import type {
  AssistantInsight,
  AuditLogEntry,
  FamilyHubState,
  GroceryItem,
  NewGroceryItemInput,
  NewTaskInput,
  Notification,
  Permission,
  Recipe,
  Task,
} from '@/types/familyHub'

const defaultBaseUrl =
  typeof window === 'undefined' ? 'http://localhost:8000' : `${window.location.protocol}//${window.location.hostname}:8000`
const configuredBaseUrl = import.meta.env.VITE_API_URL || defaultBaseUrl
const apiBaseUrl = configuredBaseUrl.endsWith('/') ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl

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
  exp?: number
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
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  const tokens = (await response.json()) as TokenResponse
  setAccessToken(tokens.accessToken)
  return tokens
}

export const refreshAccessToken = async () => {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
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
  await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
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

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken()
    headers.set('Authorization', `Bearer ${refreshedToken}`)
    const retry = await fetch(`${apiBaseUrl}${path}`, {
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
  updateGroceryItem: (itemId: number, payload: Record<string, unknown>) =>
    request(`/api/v1/grocery/items/${itemId}`, {
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
  applyMealTemplate: () =>
    request('/api/v1/meal-plan/apply-template', {
      method: 'POST',
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
  askAssistant: (query: string) =>
    request<{ answer: string; insights: AssistantInsight[] }>('/api/v1/assistant/recommendations', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
}
