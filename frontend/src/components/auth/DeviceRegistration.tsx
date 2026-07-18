import { useState } from 'react'
import { Monitor, Smartphone, Tablet } from 'lucide-react'

interface DeviceRegistrationProps {
  onRegister: (deviceName: string) => void
  onSkip: () => void
  defaultName?: string
}

const deviceIcons = [
  { key: 'desktop', icon: Monitor, label: 'Desktop' },
  { key: 'phone', icon: Smartphone, label: 'Phone' },
  { key: 'tablet', icon: Tablet, label: 'Tablet' },
] as const

export const DeviceRegistration = ({ onRegister, onSkip, defaultName }: DeviceRegistrationProps) => {
  const [name, setName] = useState(defaultName ?? '')
  const [selected, setSelected] = useState<string>('desktop')

  const handleSubmit = () => {
    const label = name.trim() || `My ${deviceIcons.find((d) => d.key === selected)?.label ?? 'Device'}`
    onRegister(label)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50" />
      <div className="relative w-full max-w-[420px] animate-scale-in rounded-3xl border border-slate-200/60 bg-white/80 p-9 shadow-2xl shadow-slate-200/50 backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Register This Device</h1>
          <p className="mt-2 text-sm text-slate-500">
            Give this device a name so you can manage it later from the Security panel.
          </p>
        </div>

        <div className="mb-5 flex justify-center gap-3">
          {deviceIcons.map(({ key, icon: Icon, label }) => (
            <button
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-medium transition-all ${
                selected === key
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
              }`}
              key={key}
              onClick={() => setSelected(key)}
              type="button"
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>

        <input
          className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-100"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="e.g. Living Room MacBook"
          value={name}
        />

        <div className="mt-6 grid gap-3">
          <button
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-blue-500 active:scale-[0.97]"
            onClick={handleSubmit}
            type="button"
          >
            Register Device
          </button>
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.97]"
            onClick={onSkip}
            type="button"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
