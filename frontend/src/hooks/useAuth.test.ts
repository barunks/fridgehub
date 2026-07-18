import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/services/api'
import { useAuth } from './useAuth'

const tokenFor = (payload: Record<string, unknown>) => {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `header.${encoded}.signature`
}

const token = tokenFor({
  sub: '1',
  username: 'meera',
  role: 'Mom',
  permissions: ['manage_family'],
  exp: Math.floor(Date.now() / 1000) + 3600,
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const mockJsonFetch = (body: unknown, status = 200) => vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(body, status)))

describe('useAuth', () => {
  beforeEach(() => {
    clearAccessToken()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stays unauthenticated when silent refresh fails', async () => {
    vi.stubGlobal('fetch', mockJsonFetch({ error: { detail: 'Refresh required' } }, 401))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isCheckingAuth).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.username).toBeNull()
    expect(result.current.authError).toBeNull()
  })

  it('restores a session from the refresh cookie without localStorage', async () => {
    vi.stubGlobal('fetch', mockJsonFetch({ accessToken: token, tokenType: 'bearer' }))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.username).toBe('meera')
    expect(result.current.role).toBe('Mom')
    expect(result.current.isParent).toBe(true)
    expect(localStorage.getItem('fridgehub-access-token')).toBeNull()
  })

  it('login stores the access token in memory only', async () => {
    vi.stubGlobal('fetch', mockJsonFetch({ accessToken: token, tokenType: 'bearer' }))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isCheckingAuth).toBe(false))

    await act(async () => {
      await result.current.login('meera', 'fridgehub')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(getAccessToken()).toBe(token)
    expect(localStorage.getItem('fridgehub-refresh-token')).toBeNull()
  })

  it('uses backend delivery targets for unverified login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ error: { detail: 'Refresh required' } }, 401))
        .mockResolvedValueOnce(jsonResponse({
          error: {
            detail: 'Account not verified. A new verification code has been sent to your email and phone. Please verify to continue.',
            code: 'account_unverified',
          },
          userId: 42,
          emailVerified: false,
          phoneVerified: false,
          verified: false,
          email: 'suravi@example.com',
          phone: '+6591234567',
        }, 403)),
    )
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isCheckingAuth).toBe(false))

    await act(async () => {
      await result.current.login('suravib', 'TestPass1')
    })

    expect(result.current.pendingVerification).toMatchObject({
      userId: 42,
      email: 'suravi@example.com',
      phone: '+6591234567',
      hasPhone: true,
    })
  })

  it('logout clears the in-memory access token', async () => {
    setAccessToken(token)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ accessToken: token, tokenType: 'bearer' }))
        .mockResolvedValueOnce(jsonResponse({ status: 'logged_out' })),
    )

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.username).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('clears the session when the API reports auth is required', async () => {
    setAccessToken(token)
    vi.stubGlobal('fetch', mockJsonFetch({ accessToken: token, tokenType: 'bearer' }))

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    act(() => {
      window.dispatchEvent(new Event('fridgehub:auth-required'))
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })
})
