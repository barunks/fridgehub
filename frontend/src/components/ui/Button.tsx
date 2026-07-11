import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:from-indigo-500 hover:to-blue-500 active:scale-[0.97]',
  secondary:
    'border border-slate-200/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-[0.97]',
  ghost:
    'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 active:scale-[0.97]',
  danger:
    'border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100 hover:shadow-md hover:shadow-rose-500/10 active:scale-[0.97]',
}

interface ButtonProps extends PropsWithChildren, ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export const Button = ({ children, className, variant = 'primary', type = 'button', ...props }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
      variantClass[variant],
      className,
    )}
    type={type}
    {...props}
  >
    {children}
  </button>
)
