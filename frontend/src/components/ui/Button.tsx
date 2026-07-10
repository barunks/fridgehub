import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
  secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
}

interface ButtonProps extends PropsWithChildren, ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export const Button = ({ children, className, variant = 'primary', type = 'button', ...props }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50',
      variantClass[variant],
      className,
    )}
    type={type}
    {...props}
  >
    {children}
  </button>
)
