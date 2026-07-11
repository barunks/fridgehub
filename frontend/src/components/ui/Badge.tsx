import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/utils/style'

type BadgeTone = 'blue' | 'green' | 'amber' | 'rose' | 'slate' | 'violet' | 'teal' | 'indigo'
type BadgeMode = 'default' | 'pill'

const toneClass: Record<BadgeTone, string> = {
  blue: 'border-blue-200/70 bg-blue-50 text-blue-700',
  green: 'border-emerald-200/70 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200/70 bg-amber-50 text-amber-700',
  rose: 'border-rose-200/70 bg-rose-50 text-rose-700',
  slate: 'border-slate-200/60 bg-slate-50/80 text-slate-600',
  violet: 'border-violet-200/70 bg-violet-50 text-violet-700',
  teal: 'border-teal-200/70 bg-teal-50 text-teal-700',
  indigo: 'border-indigo-200/70 bg-indigo-50 text-indigo-700',
}

const modeClass: Record<BadgeMode, string> = {
  default: 'min-h-6 rounded-full px-2.5 py-0.5 text-[11px]',
  pill: 'min-h-8 rounded-full px-3.5 py-1 text-xs shadow-sm',
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
      'inline-flex items-center gap-1.5 border font-semibold leading-none tracking-wide',
      modeClass[mode],
      toneClass[tone],
      className,
    )}
  >
    {icon}
    {children}
  </span>
)
