import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'icon'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-500 bg-[length:200%_100%] bg-left text-white shadow-[0_4px_16px_rgb(79_70_229/0.35)] hover:bg-right hover:shadow-[0_8px_28px_rgb(79_70_229/0.45)] active:scale-[0.97]',
  secondary:
    'border-2 border-slate-200 bg-white text-slate-800 shadow-sm hover:-translate-y-1 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700 hover:shadow-[0_6px_24px_rgb(99_102_241/0.12)] active:scale-[0.97]',
  ghost:
    'text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-700 hover:-translate-y-0.5 active:scale-[0.97]',
  danger:
    'border-2 border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100 hover:border-rose-300 hover:shadow-[0_6px_20px_rgb(244_63_94/0.15)] active:scale-[0.97]',
  outline:
    'border-2 border-indigo-200 bg-indigo-50/50 text-indigo-700 shadow-sm hover:-translate-y-0.5 hover:bg-indigo-100/60 hover:border-indigo-300 hover:shadow-md active:scale-[0.97]',
  icon:
    'border-2 border-slate-200 bg-white text-slate-600 shadow-sm hover:-translate-y-1 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 hover:shadow-[0_6px_20px_rgb(99_102_241/0.12)] active:scale-[0.94]',
}

interface ButtonProps extends PropsWithChildren, ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  iconOnly?: boolean
}

export const Button = ({ children, className, iconOnly = false, variant = 'primary', type = 'button', ...props }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
      iconOnly ? 'size-11 px-0 py-0' : 'px-5 py-2.5',
      variantClass[variant],
      className,
    )}
    type={type}
    {...props}
  >
    {children}
  </button>
)
