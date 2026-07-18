import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, LayoutDashboard, Mail, Phone, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import type { VerificationStatus } from '@/types/familyHub'

const RESEND_COOLDOWN = 60

interface VerificationPageProps {
  status: VerificationStatus
  onVerify: (emailOtp: string, phoneOtp: string) => Promise<void>
  onResend: () => Promise<void>
  onCancel: () => void
}

const OtpInput = ({
  label,
  sublabel,
  icon: Icon,
  value,
  onChange,
  verified,
  disabled,
  testId,
}: {
  label: string
  sublabel?: string
  icon: typeof Mail
  value: string
  onChange: (v: string) => void
  verified: boolean
  disabled: boolean
  testId: string
}) => (
  <div className="grid gap-1.5" data-testid={testId}>
    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-1.5">
        <Icon className="size-4 text-slate-400" aria-hidden="true" />
        <span>
          {label}
          {sublabel && (
            <span className="ml-1.5 font-normal text-slate-500">{sublabel}</span>
          )}
        </span>
      </span>
      {verified ? (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="size-3.5" aria-hidden="true" /> Verified
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
          <Clock className="size-3.5" aria-hidden="true" /> Pending
        </span>
      )}
    </div>
    <input
      aria-label={label}
      autoComplete="one-time-code"
      className={`min-h-12 w-full rounded-lg border px-3.5 py-2.5 text-center text-xl font-bold tracking-[0.5em] outline-none transition
        ${verified
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-slate-300 bg-white text-slate-950 focus:border-blue-500 focus:ring-3 focus:ring-blue-100'
        }
        disabled:pointer-events-none disabled:opacity-50`}
      disabled={disabled || verified}
      inputMode="numeric"
      maxLength={6}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000"
      type="text"
      value={value}
    />
  </div>
)

export const VerificationPage = ({ status, onVerify, onResend, onCancel }: VerificationPageProps) => {
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startCooldown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const canSubmit =
    !loading &&
    (status.emailVerified || emailOtp.length === 6) &&
    (!status.hasPhone || status.phoneVerified || phoneOtp.length === 6)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onVerify(emailOtp, phoneOtp || '000000')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError(null)
    setResending(true)
    try {
      await onResend()
      setEmailOtp('')
      setPhoneOtp('')
      startCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend codes. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const fullyVerified = status.emailVerified && (!status.hasPhone || status.phoneVerified)

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 lg:grid-cols-[0.9fr_1.1fr]">

          {/* Left panel */}
          <section className="hidden border-r border-slate-200 bg-slate-900 p-10 text-white lg:grid lg:content-between">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-white text-slate-950">
                <LayoutDashboard className="size-6" aria-hidden="true" />
              </div>
              <h1 className="mt-8 text-3xl font-bold">FridgeHub</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                Verify your identity to activate your account and access your family workspace.
              </p>

              {/* Delivery targets */}
              <div className="mt-8 grid gap-3">
                {status.email && (
                  <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                    <Mail className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-slate-500">Email code sent to</p>
                      <p className="text-sm font-semibold text-white">{status.email}</p>
                    </div>
                  </div>
                )}
                {status.hasPhone && status.phone && (
                  <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                    <Phone className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-slate-500">SMS code sent to</p>
                      <p className="text-sm font-semibold text-white">{status.phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-3 text-sm text-slate-200">
              {[
                'Codes expire in 10 minutes',
                'Each code is single-use',
                'Request a new code after expiry',
              ].map((item) => (
                <div className="flex items-center gap-3" key={item}>
                  <ShieldCheck className="size-4 text-emerald-300" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Right panel */}
          <main className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 lg:hidden">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                <LayoutDashboard className="size-5" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-2xl font-bold">FridgeHub</h1>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-950">Verify your account</h2>
              <p className="mt-1 text-sm text-slate-500">
                We sent 6-digit codes to
                {status.email && <> <span className="font-medium text-slate-700">{status.email}</span></>}
                {status.hasPhone && status.phone && (
                  <> and <span className="font-medium text-slate-700">{status.phone}</span></>
                )}
                . Codes expire in 10 minutes.
              </p>
            </div>

            {/* Delivery targets — mobile only */}
            <div className="mb-5 grid gap-2 lg:hidden">
              {status.email && (
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Mail className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Email code sent to</p>
                    <p className="truncate text-sm font-semibold text-slate-700">{status.email}</p>
                  </div>
                </div>
              )}
              {status.hasPhone && status.phone && (
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Phone className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">SMS code sent to</p>
                    <p className="truncate text-sm font-semibold text-slate-700">{status.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status banner */}
            {fullyVerified ? (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                Account fully verified. Redirecting…
              </div>
            ) : (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                <XCircle className="size-4 shrink-0" aria-hidden="true" />
                {[
                  !status.emailVerified && 'email',
                  status.hasPhone && !status.phoneVerified && 'phone',
                ]
                  .filter(Boolean)
                  .join(' and ')}{' '}
                verification pending
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                {error}
              </div>
            )}

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <OtpInput
                disabled={loading}
                icon={Mail}
                label="Email code"
                sublabel={status.email ? `(sent to ${status.email})` : undefined}
                onChange={setEmailOtp}
                value={emailOtp}
                verified={status.emailVerified}
                testId="otp-email"
              />

              {status.hasPhone && (
                <OtpInput
                  disabled={loading}
                  icon={Phone}
                  label="Phone code"
                  sublabel={status.phone ? `(sent to ${status.phone})` : undefined}
                  onChange={setPhoneOtp}
                  value={phoneOtp}
                  verified={status.phoneVerified}
                  testId="otp-phone"
                />
              )}

              <button
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-200 disabled:pointer-events-none disabled:opacity-50"
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? 'Verifying…' : 'Verify account'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:pointer-events-none disabled:opacity-40"
                disabled={cooldown > 0 || resending}
                onClick={handleResend}
                type="button"
              >
                <RefreshCw className={`size-3.5 ${resending ? 'animate-spin' : ''}`} aria-hidden="true" />
                {resending
                  ? 'Sending…'
                  : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : 'Resend codes'}
              </button>

              <button
                className="text-sm text-slate-400 hover:text-slate-600"
                onClick={onCancel}
                type="button"
              >
                Back to sign in
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
