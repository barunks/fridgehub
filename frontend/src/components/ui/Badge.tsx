import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type BadgeTone = 'blue' | 'green' | 'amber' | 'rose' | 'slate' | 'violet' | 'teal' | 'indigo'

const toneClass: Record<BadgeTone, string> = {
  blue: 'border-blue-200/60 bg-blue-50/80 text-blue-700',
  green: 'border-emerald-200/60 bg-emerald-50/80 text-emerald-700',
  amber: 'border-amber-200/60 bg-amber-50/80 text-amber-700',
  rose: 'border-rose-200/60 bg-rose-50/80 text-rose-700',
  slate: 'border-slate-200/60 bg-slate-50/80 text-slate-600',
  violet: 'border-violet-200/60 bg-violet-50/80 text-violet-700',
  teal: 'border-teal-200/60 bg-teal-50/80 text-teal-700',
  indigo: 'border-indigo-200/60 bg-indigo-50/80 text-indigo-700',
}

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone
  className?: string
}

export const Badge = ({ children, tone = 'slate', className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none tracking-wide',
      toneClass[tone],
      className,
    )}
  >
    {children}
  </span>
)
