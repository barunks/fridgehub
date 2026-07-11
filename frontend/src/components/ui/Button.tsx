import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'icon'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-500 bg-[length:200%_100%] bg-left text-white shadow-md shadow-indigo-500/25 hover:bg-right hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.97] transition-[background-position,box-shadow,transform]',
  secondary:
    'border border-slate-200/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm hover:-translate-y-0.5 hover:bg-white hover:border-slate-300 hover:shadow-md active:scale-[0.97]',
  ghost:
    'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 hover:-translate-y-0.5 active:scale-[0.97]',
  danger:
    'border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100 hover:shadow-md hover:shadow-rose-500/10 active:scale-[0.97]',
  outline:
    'border border-indigo-200/80 bg-indigo-50/40 text-indigo-700 shadow-sm hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-md active:scale-[0.97]',
  icon:
    'border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm hover:-translate-y-0.5 hover:bg-slate-50 hover:text-indigo-600 hover:shadow-md active:scale-[0.94]',
}

interface ButtonProps extends PropsWithChildren, ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  iconOnly?: boolean
}

export const Button = ({ children, className, iconOnly = false, variant = 'primary', type = 'button', ...props }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
      iconOnly ? 'size-11 px-0 py-0' : 'px-4 py-2.5',
      variantClass[variant],
      className,
    )}
    type={type}
    {...props}
  >
    {children}
  </button>
)
