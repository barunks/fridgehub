import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight, CheckCircle2, ChevronDown, Home, KeyRound, LayoutDashboard,
  Mail, Phone, Shield, Sparkles, UserRound, Users, Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import { LocationFields, defaultLocationValue, type LocationValue } from '@/components/auth/LocationFields'
import { COUNTRIES, detectCountryFromTimezone, type Country } from '@/utils/countries'
import type {
  BootstrapSignupInput,
  InviteSignupInput,
  SignupDeviceInput,
  SignupInvitePreview,
} from '@/types/familyHub'

type AuthMode = 'signin' | 'signup'
type SignupSubMode = 'admin' | 'join'

interface LoginPageProps {
  onLogin: (username: string, password: string, device?: Partial<SignupDeviceInput>) => Promise<void>
  onBootstrapSignup: (payload: BootstrapSignupInput) => Promise<void>
  onInviteSignup: (payload: InviteSignupInput) => Promise<void>
  error: string | null
}

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

const passwordHint = (value: string): string | null => {
  if (!value) return null
  if (value.length < 8) return 'At least 8 characters required.'
  if (!/[a-zA-Z]/.test(value)) return 'Must include at least one letter.'
  if (!/[0-9]/.test(value)) return 'Must include at least one number.'
  if (/\s/.test(value)) return 'Cannot contain spaces.'
  return null
}

const Field = ({
  autoComplete,
  error,
  hint,
  icon: Icon,
  label,
  onChange,
  placeholder,
  required = true,
  type = 'text',
  value,
}: {
  autoComplete?: string
  error?: string | null
  hint?: string | null
  icon: typeof UserRound
  label: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  value: string
}) => (
  <label className="grid gap-1.5 text-sm font-medium text-slate-300">
    <span>{label}</span>
    <span className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <input
        aria-label={label}
        autoComplete={autoComplete}
        className={`min-h-11 w-full rounded-xl border bg-slate-800/60 px-3.5 py-2.5 pl-10 text-[16px] leading-tight text-white outline-none transition placeholder:text-slate-600 focus:ring-2 sm:text-sm ${
          error
            ? 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20'
            : 'border-slate-700/60 focus:border-violet-500 focus:ring-violet-500/20'
        }`}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </span>
    {error && (
      <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
        <span className="inline-block size-1.5 rounded-full bg-rose-400" />
        {error}
      </span>
    )}
    {!error && hint && (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <span className="inline-block size-1.5 rounded-full bg-amber-400" />
        {hint}
      </span>
    )}
  </label>
)

const features = [
  { icon: Shield, label: 'Secure JWT sessions', color: 'text-violet-400' },
  { icon: Users, label: 'Invite-based family access', color: 'text-sky-400' },
  { icon: Zap, label: 'Real-time sync across devices', color: 'text-emerald-400' },
  { icon: Sparkles, label: 'AI-powered household insights', color: 'text-amber-400' },
]

export const LoginPage = ({ onBootstrapSignup, onInviteSignup, onLogin, error }: LoginPageProps) => {
  const initialInvite = useMemo(() => {
    const search = new URLSearchParams(window.location.search)
    return search.get('invite') || ''
  }, [])

  const [mode, setMode] = useState<AuthMode>(initialInvite ? 'signup' : 'signin')
  const [signupSubMode, setSignupSubMode] = useState<SignupSubMode>(initialInvite ? 'join' : 'admin')
  const [invitePreview, setInvitePreview] = useState<SignupInvitePreview | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [inviteToken, setInviteToken] = useState(initialInvite)
  const [joinForm, setJoinForm] = useState({ fullName: '', email: '', username: '', password: '' })
  const [joinTouched, setJoinTouched] = useState<Record<string, boolean>>({})
  const [joinPhone, setJoinPhone] = useState('')
  const [joinIsdCountry, setJoinIsdCountry] = useState<Country>(detectCountryFromTimezone)

  const [setupForm, setSetupForm] = useState({ familyName: '', fullName: '', email: '', username: '', password: '' })
  const [setupTouched, setSetupTouched] = useState<Record<string, boolean>>({})
  const [setupLocation, setSetupLocation] = useState<LocationValue>(defaultLocationValue)

  const showDemoCredentials = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true'

  useEffect(() => {
    if (initialInvite) { setMode('signup'); setSignupSubMode('join') }
  }, [initialInvite])

  useEffect(() => {
    const token = extractInviteToken(inviteToken)
    if (token.length < 16) { setInvitePreview(null); return }
    let active = true
    api.previewSignupInvite(token)
      .then((preview) => {
        if (!active) return
        setInvitePreview(preview)
        if (preview.email) setJoinForm((f) => ({ ...f, email: preview.email || f.email }))
        // Sync ISD country from family's country
        const familyCountry = COUNTRIES.find((c) => c.name === preview.country)
        if (familyCountry) setJoinIsdCountry(familyCountry)
      })
      .catch(() => { if (active) setInvitePreview(null) })
    return () => { active = false }
  }, [inviteToken])

  const currentError = localError || error
  const getDevice = async () => api.getCurrentDeviceInput()

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setLocalError(null)
    try {
      await onLogin(username, password, await getDevice())
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally { setLoading(false) }
  }

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    const pwError = passwordHint(joinForm.password)
    if (pwError) { setLocalError(pwError); return }
    setLoading(true); setLocalError(null)
    try {
      await onInviteSignup({
        ...joinForm,
        phone: `${joinIsdCountry.isd}${joinPhone.replace(/\s/g, '')}`,
        country: invitePreview?.country ?? joinIsdCountry.name,
        address: invitePreview?.address ?? '',
        postalCode: invitePreview?.postalCode ?? '',
        inviteToken: extractInviteToken(inviteToken),
        ...(await getDevice()),
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Account creation failed.')
    } finally { setLoading(false) }
  }

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault()
    const pwError = passwordHint(setupForm.password)
    if (pwError) { setLocalError(pwError); return }
    setLoading(true); setLocalError(null)
    try {
      await onBootstrapSignup({
        ...setupForm,
        homeBase: setupLocation.country.name,
        timezone: setupLocation.country.timezone,
        phone: `${setupLocation.country.isd}${setupLocation.localPhone.replace(/\s/g, '')}`,
        country: setupLocation.country.name,
        address: setupLocation.address,
        postalCode: setupLocation.postalCode,
        ...(await getDevice()),
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Family setup failed.')
    } finally { setLoading(false) }
  }

  const joinField = (key: keyof typeof joinForm) => ({
    value: joinForm[key],
    onChange: (v: string) => {
      setJoinForm((f) => ({ ...f, [key]: v }))
      setJoinTouched((t) => ({ ...t, [key]: true }))
    },
  })

  const setupField = (key: keyof typeof setupForm) => ({
    value: setupForm[key],
    onChange: (v: string) => {
      setSetupForm((f) => ({ ...f, [key]: v }))
      setSetupTouched((t) => ({ ...t, [key]: true }))
    },
  })

  const joinPasswordHint = joinTouched.password ? passwordHint(joinForm.password) : null
  const setupPasswordHint = setupTouched.password ? passwordHint(setupForm.password) : null

  const submitDisabled = {
    signin: loading || !username || !password,
    join: loading || !inviteToken.trim() || !joinForm.fullName || !joinForm.email || !joinPhone.trim() || !joinForm.username || !joinForm.password || !!joinPasswordHint,
    admin: loading || !setupForm.familyName || !setupForm.fullName || !setupForm.email || !setupLocation.localPhone || !setupLocation.postalCode || !setupLocation.address || !setupForm.username || !setupForm.password || !!setupPasswordHint,
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0f] px-4 py-4 text-white sm:px-6 sm:py-8">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-sky-600/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-5xl items-center pb-[env(safe-area-inset-bottom)] sm:min-h-[calc(100dvh-4rem)]">
        <div className="grid w-full rounded-2xl border border-white/[0.06] bg-[#0f0f1a]/80 shadow-2xl shadow-black/60 sm:backdrop-blur-xl lg:grid-cols-[0.85fr_1.15fr]">

          {/* Left panel */}
          <section className="hidden border-r border-white/[0.06] bg-gradient-to-br from-violet-950/60 via-indigo-950/40 to-slate-950/60 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
                <LayoutDashboard className="size-6 text-white" />
              </div>
              <h1 className="mt-8 text-3xl font-bold tracking-tight text-white">FridgeHub</h1>
              <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">
                Your family's private command center — groceries, meals, tasks, and more.
              </p>

              <div className="mt-10 grid gap-4">
                {features.map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                      <Icon className={`size-4 ${color}`} />
                    </div>
                    <span className="text-sm text-slate-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Trusted by families worldwide
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                End-to-end encrypted sessions. Your family data never leaves your control.
              </p>
            </div>
          </section>

          {/* Right panel — form */}
          <main className="p-6 sm:p-8 lg:p-10">
            {/* Mobile logo */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
                <LayoutDashboard className="size-5 text-white" />
              </div>
              <span className="text-xl font-bold">FridgeHub</span>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {mode === 'signin'
                  ? 'Welcome back'
                  : signupSubMode === 'admin'
                  ? 'Create your family'
                  : 'Join your family'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {mode === 'signin'
                  ? 'Sign in to your household account.'
                  : signupSubMode === 'admin'
                  ? 'Set up a new family workspace and admin account.'
                  : 'Use the invite link or code from your family admin.'}
              </p>
            </div>

            {/* Sign in / Sign up tabs */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
              {(['signin', 'signup'] as AuthMode[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-label={tab === 'signin' ? 'Show sign in form' : 'Show sign up form'}
                  className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-all ${
                    mode === tab
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  onClick={() => { setMode(tab); setLocalError(null) }}
                >
                  {tab === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            {/* Admin / Join sub-tabs */}
            {mode === 'signup' && (
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
                {([['admin', 'Family Admin'], ['join', 'Join Family']] as [SignupSubMode, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-all ${
                      signupSubMode === key
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    onClick={() => { setSignupSubMode(key); setLocalError(null) }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Error banner */}
            {currentError && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                <span className="mt-0.5 inline-block size-2 shrink-0 rounded-full bg-rose-400" />
                <span>{currentError}</span>
              </div>
            )}

            {/* Sign in form */}
            {mode === 'signin' && (
              <form className="grid gap-4" onSubmit={handleSignIn}>
                <Field autoComplete="username" icon={UserRound} label="Username or email" onChange={setUsername} value={username} placeholder="e.g. meera" />
                <Field autoComplete="current-password" icon={KeyRound} label="Password" onChange={setPassword} type="password" value={password} placeholder="Your password" />
                <SubmitButton loading={loading} disabled={submitDisabled.signin} label="Sign in" loadingLabel="Signing in…" />
                {showDemoCredentials && (
                  <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-center text-xs text-slate-500">
                    Demo: <span className="font-semibold text-slate-300">meera</span> / <span className="font-semibold text-slate-300">fridgehub</span>
                  </p>
                )}
              </form>
            )}

            {/* Join Family form */}
            {mode === 'signup' && signupSubMode === 'join' && (
              <form className="grid gap-4" onSubmit={handleJoin}>
                <Field icon={KeyRound} label="Invite link or code" onChange={setInviteToken} value={inviteToken} placeholder="Paste the invite link or token" />
                {invitePreview && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>
                      Joining <strong className="text-emerald-200">{invitePreview.familyName}</strong> as{' '}
                      <strong className="text-emerald-200">{invitePreview.role}</strong>.{' '}
                      Expires {new Date(invitePreview.expiresAt).toLocaleDateString()}.
                    </span>
                  </div>
                )}
                <Field autoComplete="name" icon={UserRound} label="Full name" {...joinField('fullName')} placeholder="Your full name" />
                <Field autoComplete="email" icon={Mail} label="Email" {...joinField('email')} type="email" placeholder="Email that received the invite" />
                <JoinPhoneField isdCountry={joinIsdCountry} onIsdChange={setJoinIsdCountry} phone={joinPhone} onPhoneChange={setJoinPhone} />
                <Field autoComplete="username" icon={UserRound} label="Username" {...joinField('username')} placeholder="Choose a unique username" />
                <Field
                  autoComplete="new-password"
                  icon={KeyRound}
                  label="Password"
                  {...joinField('password')}
                  type="password"
                  hint={joinPasswordHint}
                  placeholder="Min 8 chars, letter + number"
                />
                <SubmitButton loading={loading} disabled={submitDisabled.join} label="Create account" loadingLabel="Creating account…" />
              </form>
            )}

            {/* Family Admin form */}
            {mode === 'signup' && signupSubMode === 'admin' && (
              <form className="grid gap-4" onSubmit={handleSetup}>
                <Field icon={Home} label="Family name" {...setupField('familyName')} placeholder="e.g. The Krishnamurthy Family" />
                <Field autoComplete="name" icon={UserRound} label="Your full name" {...setupField('fullName')} placeholder="Admin's full name" />
                <Field autoComplete="email" icon={Mail} label="Email" {...setupField('email')} type="email" placeholder="admin@example.com" />
                <LocationFields value={setupLocation} onChange={setSetupLocation} phoneLabel="Phone number" />
                <Field autoComplete="username" icon={UserRound} label="Username" {...setupField('username')} placeholder="Choose a unique username" />
                <Field
                  autoComplete="new-password"
                  icon={KeyRound}
                  label="Password"
                  {...setupField('password')}
                  type="password"
                  hint={setupPasswordHint}
                  placeholder="Min 8 chars, letter + number"
                />
                <SubmitButton loading={loading} disabled={submitDisabled.admin} label="Create family" loadingLabel="Creating family…" />
              </form>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

/** Phone field for Join Family — ISD searchable dropdown + local number */
const JoinPhoneField = ({
  isdCountry,
  onIsdChange,
  phone,
  onPhoneChange,
}: {
  isdCountry: Country
  onIsdChange: (c: Country) => void
  phone: string
  onPhoneChange: (v: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.isd.includes(query))
    : COUNTRIES

  useEffect(() => {
    if (!open) { setQuery(''); return }
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-300">
      <span>Phone number</span>
      <div className="flex" ref={ref}>
        {/* ISD dropdown */}
        <div className="relative">
          <button
            type="button"
            aria-label="ISD code"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-700/60 bg-slate-800/60 px-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700/60"
            onClick={() => setOpen((o) => !o)}
          >
            <Phone className="size-3.5 shrink-0 text-slate-500" />
            <span>{isdCountry.isd}</span>
            <ChevronDown className="size-3 text-slate-500" />
          </button>
          {open && (
            <div className="absolute z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/[0.08] bg-[#13131f] shadow-2xl shadow-black/60">
              <div className="border-b border-white/[0.06] p-2">
                <input
                  ref={inputRef}
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[16px] text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
                  placeholder="Search country or code…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <ul className="max-h-[40vh] overflow-y-auto overscroll-contain py-1" role="listbox" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No results</li>}
                {filtered.map((c) => (
                  <li
                    key={c.code}
                    role="option"
                    aria-selected={c.code === isdCountry.code}
                    className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-violet-500/10 ${
                      c.code === isdCountry.code ? 'bg-violet-500/10 font-semibold text-violet-300' : 'text-slate-300'
                    }`}
                    onMouseDown={() => { onIsdChange(c); setOpen(false) }}
                  >
                    <span>{c.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-slate-500">{c.isd}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <input
          aria-label="Phone number"
          autoComplete="tel-national"
          className="min-h-11 flex-1 rounded-r-xl border border-l-0 border-slate-700/60 bg-slate-800/60 px-3.5 py-2.5 text-[16px] leading-tight text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
          inputMode="tel"
          onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d\s\-()]/g, ''))}
          placeholder="e.g. 9123 4567"
          type="tel"
          value={phone}
        />
      </div>
    </div>
  )
}

const SubmitButton = ({
  disabled,
  label,
  loading,
  loadingLabel,
}: {
  disabled: boolean
  label: string
  loading: boolean
  loadingLabel: string
}) => (
  <button
    className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:pointer-events-none disabled:opacity-40"
    disabled={disabled}
    type="submit"
  >
    {loading ? loadingLabel : label}
    {!loading && <ArrowRight className="size-4" />}
  </button>
)
