import { useCallback, useEffect, useState } from 'react'

const ACCESS_TOKEN_KEY = 'familyhub-access-token'
const REFRESH_TOKEN_KEY = 'familyhub-refresh-token'

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
}

function parseJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ?? null
  } catch {
    return null
  }
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem(ACCESS_TOKEN_KEY))
  const [authError, setAuthError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return null
    try {
      return JSON.parse(atob(token.split('.')[1])).username ?? null
    } catch {
      return null
    }
  })

  const login = useCallback(async (user: string, password: string) => {
    setAuthError(null)
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({ detail: 'Login failed' }))
      setAuthError(body.detail || 'Invalid credentials')
      throw new Error(body.detail || 'Login failed')
    }
    const tokens = (await response.json()) as TokenResponse
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    try {
      setUsername(JSON.parse(atob(tokens.accessToken.split('.')[1])).username ?? user)
    } catch {
      setUsername(user)
    }
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (token) {
      await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }).catch(() => undefined)
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    setIsAuthenticated(false)
    setUsername(null)
  }, [])

  // Auto-logout when token expires
  useEffect(() => {
    if (!isAuthenticated) return
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    const exp = parseJwtExp(token)
    if (!exp) return
    const msUntilExpiry = exp * 1000 - Date.now()
    if (msUntilExpiry <= 0) {
      logout()
      return
    }
    const timer = setTimeout(() => logout(), msUntilExpiry)
    return () => clearTimeout(timer)
  }, [isAuthenticated, logout])

  return { isAuthenticated, authError, username, login, logout }
}
