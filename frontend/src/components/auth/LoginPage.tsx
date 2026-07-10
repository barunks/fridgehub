import { useState, type FormEvent } from 'react'
import { LayoutDashboard } from 'lucide-react'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>
  error: string | null
}

export const LoginPage = ({ onLogin, error }: LoginPageProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onLogin(username, password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-lg bg-blue-600 text-white">
            <LayoutDashboard className="size-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">FamilyHub</h1>
          <p className="text-sm text-slate-500">Sign in to your family command center</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="username">
              Username
            </label>
            <input
              autoComplete="username"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              id="username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              type="text"
              value={username}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              type="password"
              value={password}
            />
          </div>

          <button
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || !username || !password}
            type="submit"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Demo: meera / familyhub
        </p>
      </div>
    </div>
  )
}
