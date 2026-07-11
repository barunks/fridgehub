import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type CardVariant = 'primary' | 'secondary' | 'subtle' | 'accent' | 'elevated'

interface CardProps extends PropsWithChildren {
  className?: string
  variant?: CardVariant
}

const cardVariantClass: Record<CardVariant, string> = {
  primary:
    'bg-white border border-slate-200/70 shadow-[0_4px_24px_rgb(15_23_42/0.06)] hover:shadow-[0_8px_40px_rgb(15_23_42/0.10)] hover:-translate-y-0.5 hover:border-indigo-200/50',
  secondary:
    'bg-white/70 border border-slate-200/60 shadow-[0_4px_20px_rgb(15_23_42/0.05)] backdrop-blur-xl hover:shadow-[0_12px_40px_rgb(15_23_42/0.10)] hover:-translate-y-1 hover:bg-white/90',
  subtle:
    'bg-gradient-to-br from-slate-50/90 to-white border border-slate-200/50 shadow-sm hover:shadow-md hover:-translate-y-0.5',
  accent:
    'accent-panel border-0 text-white shadow-[0_20px_60px_rgb(79_70_229/0.35)]',
  elevated:
    'bg-white border border-slate-200/60 shadow-[0_8px_32px_rgb(15_23_42/0.08)] hover:shadow-[0_16px_56px_rgb(15_23_42/0.14)] hover:-translate-y-1 hover:border-indigo-200/40',
}

export const Card = ({ children, className, variant = 'primary' }: CardProps) => (
  <section
    className={cn(
      'rounded-2xl transition-all duration-300',
      cardVariantClass[variant],
      className,
    )}
  >
    {children}
  </section>
)

export const CardHeader = ({ children, className }: CardProps) => (
  <div className={cn('border-b border-slate-100/80 px-6 py-5', className)}>{children}</div>
)

export const CardTitle = ({ children, className }: CardProps) => (
  <h2 className={cn('text-[0.95rem] font-semibold tracking-tight text-slate-950', className)}>{children}</h2>
)

export const CardContent = ({ children, className }: CardProps) => (
  <div className={cn('px-6 py-5', className)}>{children}</div>
)
