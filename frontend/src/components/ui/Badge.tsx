import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/utils/style'

type BadgeTone = 'blue' | 'green' | 'amber' | 'rose' | 'slate' | 'violet' | 'teal' | 'indigo'
type BadgeMode = 'default' | 'pill'

const toneClass: Record<BadgeTone, string> = {
  blue: 'border-blue-200/80 bg-blue-100/70 text-blue-800',
  green: 'border-emerald-200/80 bg-emerald-100/70 text-emerald-800',
  amber: 'border-amber-200/80 bg-amber-100/70 text-amber-800',
  rose: 'border-rose-200/80 bg-rose-100/70 text-rose-800',
  slate: 'border-slate-200/70 bg-slate-100/60 text-slate-700',
  violet: 'border-violet-200/80 bg-violet-100/70 text-violet-800',
  teal: 'border-teal-200/80 bg-teal-100/70 text-teal-800',
  indigo: 'border-indigo-200/80 bg-indigo-100/70 text-indigo-800',
}

const pillToneClass: Record<BadgeTone, string> = {
  blue: 'border-blue-300/60 bg-gradient-to-r from-blue-50 to-blue-100/80 text-blue-800 shadow-blue-100/50',
  green: 'border-emerald-300/60 bg-gradient-to-r from-emerald-50 to-emerald-100/80 text-emerald-800 shadow-emerald-100/50',
  amber: 'border-amber-300/60 bg-gradient-to-r from-amber-50 to-amber-100/80 text-amber-800 shadow-amber-100/50',
  rose: 'border-rose-300/60 bg-gradient-to-r from-rose-50 to-rose-100/80 text-rose-800 shadow-rose-100/50',
  slate: 'border-slate-300/60 bg-gradient-to-r from-slate-50 to-slate-100/80 text-slate-700 shadow-slate-100/50',
  violet: 'border-violet-300/60 bg-gradient-to-r from-violet-50 to-violet-100/80 text-violet-800 shadow-violet-100/50',
  teal: 'border-teal-300/60 bg-gradient-to-r from-teal-50 to-teal-100/80 text-teal-800 shadow-teal-100/50',
  indigo: 'border-indigo-300/60 bg-gradient-to-r from-indigo-50 to-indigo-100/80 text-indigo-800 shadow-indigo-100/50',
}

const modeClass: Record<BadgeMode, string> = {
  default: 'min-h-6 rounded-full px-2.5 py-0.5 text-[11px]',
  pill: 'min-h-8 rounded-full px-4 py-1.5 text-xs shadow-sm',
}

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone
  mode?: BadgeMode
  icon?: ReactNode
  className?: string
}

export const Badge = ({ children, className, icon, mode = 'default', tone = 'slate' }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 border font-semibold leading-none',
      modeClass[mode],
      mode === 'pill' ? pillToneClass[tone] : toneClass[tone],
      className,
    )}
  >
    {icon}
    {children}
  </span>
)
