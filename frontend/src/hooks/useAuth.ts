import { useCallback, useEffect, useState } from 'react'
import { isUnverifiedAccountError, api, clearAccessToken, parseAccessToken, setAccessToken } from '@/services/api'
import type { BootstrapSignupInput, InviteSignupInput, Permission, SignupDeviceInput, VerificationStatus } from '@/types/familyHub'

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!api.getAccessToken())
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false)
  const [pendingVerification, setPendingVerification] = useState<VerificationStatus | null>(null)
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

  const login = useCallback(async (user: string, password: string, device?: Partial<SignupDeviceInput>) => {
    setAuthError(null)
    setIsDeviceBlocked(false)
    try {
      const tokens = await api.loginUser(user, password, device)
      applyToken(tokens.accessToken)
    } catch (error) {
      if (isUnverifiedAccountError(error)) {
        setPendingVerification(error.status)
        return
      }
      const message = error instanceof Error ? error.message : 'Login failed'
      if (message.toLowerCase().includes('revoked')) {
        setIsDeviceBlocked(true)
      }
      setAuthError(message)
      throw error
    }
  }, [applyToken])

  const bootstrapSignup = useCallback(async (payload: BootstrapSignupInput) => {
    setAuthError(null)
    setIsDeviceBlocked(false)
    try {
      const { userId: newUserId, email, phone } = await api.bootstrapSignup(payload)
      const hasPhone = phone.replace(/\D/g, '').length >= 8
      setPendingVerification({ userId: newUserId, emailVerified: false, phoneVerified: false, verified: false, hasPhone, email, phone: hasPhone ? phone : undefined })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed'
      setAuthError(message)
      throw error
    }
  }, [])

  const inviteSignup = useCallback(async (payload: InviteSignupInput) => {
    setAuthError(null)
    setIsDeviceBlocked(false)
    try {
      const { userId: newUserId, email, phone } = await api.signupWithInvite(payload)
      const hasPhone = phone.replace(/\D/g, '').length >= 8
      setPendingVerification({ userId: newUserId, emailVerified: false, phoneVerified: false, verified: false, hasPhone, email, phone: hasPhone ? phone : undefined })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed'
      setAuthError(message)
      throw error
    }
  }, [])

  const verifyOtp = useCallback(async (emailOtp: string, phoneOtp: string) => {
    if (!pendingVerification) return
    const result = await api.verifyOtp(pendingVerification.userId, emailOtp, phoneOtp)
    if (result.verified) {
      setPendingVerification(null)
      // Token is already in memory from signup; trigger a refresh to get a clean session
      const token = await api.refreshAccessToken().catch(() => null)
      if (token) applyToken(token)
    } else {
      setPendingVerification((prev) => prev ? { ...prev, ...result } : prev)
    }
  }, [applyToken, pendingVerification])

  const resendOtp = useCallback(async () => {
    if (!pendingVerification) return
    const result = await api.resendOtp(pendingVerification.userId)
    setPendingVerification((prev) => prev ? { ...prev, ...result } : prev)
  }, [pendingVerification])

  const dismissVerification = useCallback(() => {
    setPendingVerification(null)
    clearAccessToken()
  }, [])

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
    window.addEventListener('fridgehub:auth-required', handler)
    return () => window.removeEventListener('fridgehub:auth-required', handler)
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

  const retryFromBlocked = useCallback(() => {
    setIsDeviceBlocked(false)
    setAuthError(null)
  }, [])

  return {
    isAuthenticated,
    isCheckingAuth,
    authError,
    isDeviceBlocked,
    pendingVerification,
    username,
    userId,
    role,
    capabilities,
    isParent: capabilities.includes('manage_family'),
    login,
    bootstrapSignup,
    inviteSignup,
    logout,
    retryFromBlocked,
    verifyOtp,
    resendOtp,
    dismissVerification,
  }
}
