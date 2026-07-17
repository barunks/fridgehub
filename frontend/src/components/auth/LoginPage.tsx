import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Home, KeyRound, LayoutDashboard, Mail, UserRound } from 'lucide-react'
import { api } from '@/services/api'
import type {
  BootstrapSignupInput,
  InviteSignupInput,
  SignupDeviceInput,
  SignupInvitePreview,
  SignupStatus,
} from '@/types/familyHub'

type AuthMode = 'signin' | 'join' | 'setup'

interface LoginPageProps {
  onLogin: (username: string, password: string, device?: Partial<SignupDeviceInput>) => Promise<void>
  onBootstrapSignup: (payload: BootstrapSignupInput) => Promise<void>
  onInviteSignup: (payload: InviteSignupInput) => Promise<void>
  error: string | null
}

const inputClass =
  'min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100'

const extractInviteToken = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return url.searchParams.get('invite') || trimmed
  } catch {
    return trimmed
  }
}

const Field = ({
  autoComplete,
  icon: Icon,
  label,
  onChange,
  placeholder,
  required = true,
  type = 'text',
  value,
}: {
  autoComplete?: string
  icon: typeof UserRound
  label: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  value: string
}) => (
  <label className="grid gap-2 text-sm font-semibold text-slate-700">
    <span>{label}</span>
    <span className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        aria-label={label}
        autoComplete={autoComplete}
        className={`${inputClass} pl-10`}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </span>
  </label>
)

export const LoginPage = ({ onBootstrapSignup, onInviteSignup, onLogin, error }: LoginPageProps) => {
  const initialInvite = useMemo(() => {
    const search = new URLSearchParams(window.location.search)
    return search.get('invite') || ''
  }, [])

  const [mode, setMode] = useState<AuthMode>(initialInvite ? 'join' : 'signin')
  const [status, setStatus] = useState<SignupStatus | null>(null)
  const [invitePreview, setInvitePreview] = useState<SignupInvitePreview | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState(initialInvite)
  const [joinForm, setJoinForm] = useState({ fullName: '', email: '', username: '', password: '' })
  const [setupForm, setSetupForm] = useState({
    familyName: 'FridgeHub',
    homeBase: 'Singapore',
    timezone: 'Asia/Singapore',
    fullName: '',
    email: '',
    username: '',
    password: '',
  })
  const showDemoCredentials = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true'

  useEffect(() => {
    api.getSignupStatus().then(setStatus).catch(() => setStatus({ bootstrapAllowed: false }))
  }, [])

  useEffect(() => {
    if (status && !status.bootstrapAllowed && mode === 'setup') {
      setMode(initialInvite ? 'join' : 'signin')
    }
  }, [initialInvite, mode, status])

  useEffect(() => {
    const token = extractInviteToken(inviteToken)
    if (token.length < 16) {
      setInvitePreview(null)
      return
    }
    let active = true
    api
      .previewSignupInvite(token)
      .then((preview) => {
        if (!active) return
        setInvitePreview(preview)
        if (preview.email) {
          setJoinForm((current) => ({ ...current, email: preview.email || current.email }))
        }
      })
      .catch(() => {
        if (active) setInvitePreview(null)
      })
    return () => {
      active = false
    }
  }, [inviteToken])

  const currentError = localError || error
  const getDevice = async () => api.getCurrentDeviceInput()
  const tabs: Array<{ key: AuthMode; label: string }> = [
    { key: 'signin', label: 'Sign in' },
    { key: 'join', label: 'Join' },
    ...(status?.bootstrapAllowed ? [{ key: 'setup' as const, label: 'Setup' }] : []),
  ]

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setLocalError(null)
    try {
      await onLogin(username, password, await getDevice())
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setLocalError(null)
    try {
      await onInviteSignup({
        ...joinForm,
        inviteToken: extractInviteToken(inviteToken),
        ...(await getDevice()),
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setLocalError(null)
    try {
      await onBootstrapSignup({
        ...setupForm,
        ...(await getDevice()),
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden border-r border-slate-200 bg-slate-900 p-10 text-white lg:grid lg:content-between">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-white text-slate-950">
                <LayoutDashboard className="size-6" aria-hidden="true" />
              </div>
              <h1 className="mt-8 text-3xl font-bold">FridgeHub</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                Private household access for groceries, meals, tasks, and family operations.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-200">
              {['Secure session refresh', 'Invite-based signup', 'Automatic browser registration'].map((item) => (
                <div className="flex items-center gap-3" key={item}>
                  <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <main className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 lg:hidden">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                <LayoutDashboard className="size-5" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-2xl font-bold">FridgeHub</h1>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-950">
                {mode === 'signin' ? 'Welcome back' : mode === 'join' ? 'Create your account' : 'Set up FridgeHub'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === 'signin' ? 'Use your family account to continue.' : mode === 'join' ? 'Use the invite shared by your family admin.' : 'Create the first admin account.'}
              </p>
            </div>

            <div className="mb-6 grid gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
              {tabs.map((tab) => (
                <button
                  aria-label={`Show ${tab.label} form`}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${mode === tab.key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  key={tab.key}
                  onClick={() => {
                    setMode(tab.key)
                    setLocalError(null)
                  }}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {currentError && (
              <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                {currentError}
              </div>
            )}

            {mode === 'signin' && (
              <form className="grid gap-4" onSubmit={handleSignIn}>
                <Field autoComplete="username" icon={UserRound} label="Username or email" onChange={setUsername} value={username} />
                <Field autoComplete="current-password" icon={KeyRound} label="Password" onChange={setPassword} type="password" value={password} />
                <button
                  className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-200 disabled:pointer-events-none disabled:opacity-50"
                  disabled={loading || !username || !password}
                  type="submit"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </form>
            )}

            {mode === 'join' && (
              <form className="grid gap-4" onSubmit={handleJoin}>
                <Field icon={KeyRound} label="Invite link or code" onChange={setInviteToken} value={inviteToken} />
                {invitePreview && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Joining {invitePreview.familyName} as {invitePreview.role}. Invite expires {new Date(invitePreview.expiresAt).toLocaleDateString()}.
                  </div>
                )}
                <Field autoComplete="name" icon={UserRound} label="Full name" onChange={(value) => setJoinForm((current) => ({ ...current, fullName: value }))} value={joinForm.fullName} />
                <Field autoComplete="email" icon={Mail} label="Email" onChange={(value) => setJoinForm((current) => ({ ...current, email: value }))} type="email" value={joinForm.email} />
                <Field autoComplete="username" icon={UserRound} label="Username" onChange={(value) => setJoinForm((current) => ({ ...current, username: value }))} value={joinForm.username} />
                <Field autoComplete="new-password" icon={KeyRound} label="Password" onChange={(value) => setJoinForm((current) => ({ ...current, password: value }))} type="password" value={joinForm.password} />
                <button
                  className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-200 disabled:pointer-events-none disabled:opacity-50"
                  disabled={loading || !inviteToken.trim() || !joinForm.fullName || !joinForm.email || !joinForm.username || !joinForm.password}
                  type="submit"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </form>
            )}

            {mode === 'setup' && (
              <form className="grid gap-4" onSubmit={handleSetup}>
                <Field icon={Home} label="Family name" onChange={(value) => setSetupForm((current) => ({ ...current, familyName: value }))} value={setupForm.familyName} />
                <Field autoComplete="name" icon={UserRound} label="Admin full name" onChange={(value) => setSetupForm((current) => ({ ...current, fullName: value }))} value={setupForm.fullName} />
                <Field autoComplete="email" icon={Mail} label="Admin email" onChange={(value) => setSetupForm((current) => ({ ...current, email: value }))} type="email" value={setupForm.email} />
                <Field autoComplete="username" icon={UserRound} label="Admin username" onChange={(value) => setSetupForm((current) => ({ ...current, username: value }))} value={setupForm.username} />
                <Field autoComplete="new-password" icon={KeyRound} label="Password" onChange={(value) => setSetupForm((current) => ({ ...current, password: value }))} type="password" value={setupForm.password} />
                <button
                  className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-200 disabled:pointer-events-none disabled:opacity-50"
                  disabled={loading || !status?.bootstrapAllowed || !setupForm.familyName || !setupForm.fullName || !setupForm.email || !setupForm.username || !setupForm.password}
                  type="submit"
                >
                  {loading ? 'Creating family...' : 'Create family'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </form>
            )}

            {showDemoCredentials && mode === 'signin' && (
              <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
                Demo: <span className="font-semibold text-slate-900">meera</span> / <span className="font-semibold text-slate-900">fridgehub</span>
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
