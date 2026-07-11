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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50" />
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />

      <div className="relative w-full max-w-[400px] animate-scale-in rounded-3xl border border-slate-200/60 bg-white/80 p-9 shadow-2xl shadow-slate-200/50 backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/30">
            <LayoutDashboard className="size-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">FamilyHub</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to your family command center</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-[13px] font-medium tracking-wide text-slate-600" htmlFor="username">
              Username
            </label>
            <input
              autoComplete="username"
              className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-100 focus:shadow-md hover:border-slate-300"
              id="username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              type="text"
              value={username}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-[13px] font-medium tracking-wide text-slate-600" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-100 focus:shadow-md hover:border-slate-300"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              type="password"
              value={password}
            />
          </div>

          <button
            className="mt-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-indigo-500 hover:to-blue-500 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            disabled={loading || !username || !password}
            type="submit"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-slate-400">
          Demo: <span className="font-medium text-slate-500">meera</span> / <span className="font-medium text-slate-500">familyhub</span>
        </p>
      </div>
    </div>
  )
}
