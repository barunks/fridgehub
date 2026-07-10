import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type BadgeTone = 'blue' | 'green' | 'amber' | 'rose' | 'slate' | 'violet' | 'teal'

const toneClass: Record<BadgeTone, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
}

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone
  className?: string
}

export const Badge = ({ children, tone = 'slate', className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-medium leading-none',
      toneClass[tone],
      className,
    )}
  >
    {children}
  </span>
)
