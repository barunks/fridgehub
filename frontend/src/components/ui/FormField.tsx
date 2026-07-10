import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

interface FormFieldProps extends PropsWithChildren {
  label: string
  className?: string
}

export const FormField = ({ label, children, className }: FormFieldProps) => (
  <label className={cn('grid gap-1.5 text-sm font-medium text-slate-700', className)}>
    <span>{label}</span>
    {children}
  </label>
)

export const inputClass =
  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
