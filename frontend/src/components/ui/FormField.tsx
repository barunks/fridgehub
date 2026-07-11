import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

interface FormFieldProps extends PropsWithChildren {
  label: string
  className?: string
}

export const FormField = ({ label, children, className }: FormFieldProps) => (
  <label className={cn('grid gap-2 text-[13px] font-medium text-slate-600', className)}>
    <span className="tracking-wide">{label}</span>
    {children}
  </label>
)

export const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 focus:shadow-md hover:border-slate-300'
