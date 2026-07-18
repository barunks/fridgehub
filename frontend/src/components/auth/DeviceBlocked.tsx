import { ShieldX } from 'lucide-react'

interface DeviceBlockedProps {
  onRetry: () => void
}

export const DeviceBlocked = ({ onRetry }: DeviceBlockedProps) => (
  <div className="flex min-h-dvh items-center justify-center px-4">
    <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-slate-50" />
    <div className="relative w-full max-w-[420px] animate-scale-in rounded-3xl border border-rose-200/60 bg-white/80 p-9 shadow-2xl shadow-rose-200/30 backdrop-blur-xl text-center">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30">
        <ShieldX className="size-8" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Device Blocked</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        This device has been revoked by a family administrator. You cannot access FridgeHub from this device.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        If you believe this is a mistake, contact a parent or admin in your family to restore access.
      </p>
      <button
        className="mt-7 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.97]"
        onClick={onRetry}
        type="button"
      >
        Try Again
      </button>
    </div>
  </div>
)
