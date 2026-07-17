import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

interface FormFieldProps extends PropsWithChildren {
  label: string
  className?: string
  variant?: 'default' | 'floating' | 'pill'
}

export const FormField = ({ label, children, className, variant = 'default' }: FormFieldProps) => (
  <label
    className={cn(
      'grid min-w-0 text-[13px] font-medium text-slate-600',
      variant === 'default' && 'gap-2',
      variant === 'floating' && 'gap-1.5 rounded-2xl border border-slate-200/70 bg-white/70 px-3.5 py-2 shadow-inner',
      variant === 'pill' && 'gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3',
      className,
    )}
  >
    <span className={cn('tracking-wide', variant !== 'default' && 'text-[11px] uppercase text-slate-400')}>{label}</span>
    {children}
  </label>
)

export const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 shadow-inner outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-100 focus:shadow-md hover:border-slate-300'
