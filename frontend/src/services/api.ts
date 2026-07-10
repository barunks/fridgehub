import type { FamilyHubState, NewGroceryItemInput, NewTaskInput } from '@/types/familyHub'

const configuredBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const apiBaseUrl = configuredBaseUrl.endsWith('/') ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl
const accessTokenKey = 'familyhub-access-token'
const refreshTokenKey = 'familyhub-refresh-token'

interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
}

const saveTokens = (tokens: TokenResponse) => {
  window.localStorage.setItem(accessTokenKey, tokens.accessToken)
  window.localStorage.setItem(refreshTokenKey, tokens.refreshToken)
}

const login = async () => {
  // This path is only hit when a request is made without a token.
  // The useAuth hook handles interactive login; this is a fallback that throws
  // so the UI can redirect to the login page.
  throw new Error('AUTH_REQUIRED')
}

const refreshAccessToken = async () => {
  const refreshToken = window.localStorage.getItem(refreshTokenKey)
  if (!refreshToken) {
    return login()
  }
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!response.ok) {
    return login()
  }
  const tokens = (await response.json()) as TokenResponse
  saveTokens(tokens)
  return tokens.accessToken
}

const getAccessToken = async () => {
  const token = window.localStorage.getItem(accessTokenKey)
  return token || login()
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = await getAccessToken()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    ...init,
  })

  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken()
    const retry = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshedToken}`,
        ...init?.headers,
      },
      ...init,
    })
    if (!retry.ok) {
      throw new Error(`API ${retry.status}: ${retry.statusText}`)
    }
    return retry.json() as Promise<T>
  }

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  login,
  bootstrap: () => request<FamilyHubState>('/api/v1/family/bootstrap'),
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
  createAnnouncement: (title: string, message: string) =>
    request('/api/v1/family/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, message, ownerId: 1, tag: 'family' }),
    }),
  askAssistant: (query: string) =>
    request<{ answer: string }>('/api/v1/assistant/recommendations', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
}
