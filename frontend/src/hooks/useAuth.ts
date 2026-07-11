import { useCallback, useEffect, useState } from 'react'
import { api, clearAccessToken, parseAccessToken, setAccessToken } from '@/services/api'
import type { Permission } from '@/types/familyHub'

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!api.getAccessToken())
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(() => parseAccessToken()?.username ?? null)
  const [userId, setUserId] = useState<number | null>(() => Number(parseAccessToken()?.sub) || null)
  const [role, setRole] = useState<string | null>(() => parseAccessToken()?.role ?? null)
  const [capabilities, setCapabilities] = useState<Permission[]>(() => parseAccessToken()?.permissions ?? [])

  const applyToken = useCallback((token: string | null) => {
    setAccessToken(token)
    const payload = parseAccessToken(token)
    setUsername(payload?.username ?? null)
    setUserId(Number(payload?.sub) || null)
    setRole(payload?.role ?? null)
    setCapabilities(payload?.permissions ?? [])
    setIsAuthenticated(Boolean(token && payload))
  }, [])

  const clearSession = useCallback(() => {
    clearAccessToken()
    setIsAuthenticated(false)
    setUsername(null)
    setUserId(null)
    setRole(null)
    setCapabilities([])
  }, [])

  const login = useCallback(async (user: string, password: string) => {
    setAuthError(null)
    try {
      const tokens = await api.loginUser(user, password)
      applyToken(tokens.accessToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      setAuthError(message)
      throw error
    }
  }, [applyToken])

  const logout = useCallback(async () => {
    await api.logoutUser()
    clearSession()
  }, [clearSession])

  useEffect(() => {
    let active = true
    api
      .refreshAccessToken()
      .then((token) => {
        if (active) applyToken(token)
      })
      .catch(() => {
        if (active) clearSession()
      })
      .finally(() => {
        if (active) setIsCheckingAuth(false)
      })
    return () => {
      active = false
    }
  }, [applyToken, clearSession])

  useEffect(() => {
    const handler = () => {
      clearSession()
    }
    window.addEventListener('familyhub:auth-required', handler)
    return () => window.removeEventListener('familyhub:auth-required', handler)
  }, [clearSession])

  useEffect(() => {
    if (!isAuthenticated) return
    const exp = parseAccessToken()?.exp
    if (!exp) return
    const msUntilRefresh = exp * 1000 - Date.now() - 60_000
    const timer = window.setTimeout(
      () => {
        api.refreshAccessToken().then(applyToken).catch(clearSession)
      },
      Math.max(1_000, msUntilRefresh),
    )
    return () => window.clearTimeout(timer)
  }, [applyToken, clearSession, isAuthenticated])

  return {
    isAuthenticated,
    isCheckingAuth,
    authError,
    username,
    userId,
    role,
    capabilities,
    isParent: capabilities.includes('manage_family'),
    login,
    logout,
  }
}
