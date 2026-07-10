import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts unauthenticated when no token in storage', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.username).toBeNull()
    expect(result.current.authError).toBeNull()
  })

  it('starts authenticated when token exists in storage', () => {
    // Create a fake JWT with username in payload
    const payload = btoa(JSON.stringify({ sub: '1', username: 'meera', exp: Math.floor(Date.now() / 1000) + 3600 }))
    const fakeToken = `header.${payload}.signature`
    localStorage.setItem('familyhub-access-token', fakeToken)

    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.username).toBe('meera')
  })

  it('logout clears tokens and sets unauthenticated', async () => {
    const payload = btoa(JSON.stringify({ sub: '1', username: 'meera', exp: Math.floor(Date.now() / 1000) + 3600 }))
    const fakeToken = `header.${payload}.signature`
    localStorage.setItem('familyhub-access-token', fakeToken)
    localStorage.setItem('familyhub-refresh-token', 'refresh-token')

    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.username).toBeNull()
    expect(localStorage.getItem('familyhub-access-token')).toBeNull()
    expect(localStorage.getItem('familyhub-refresh-token')).toBeNull()
  })

  it('auto-logouts when token is expired', async () => {
    const payload = btoa(JSON.stringify({ sub: '1', username: 'meera', exp: Math.floor(Date.now() / 1000) - 10 }))
    const fakeToken = `header.${payload}.signature`
    localStorage.setItem('familyhub-access-token', fakeToken)

    const { result } = renderHook(() => useAuth())
    // Effect runs async — wait for it
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.isAuthenticated).toBe(false)
  })
})
