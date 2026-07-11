import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

type CardVariant = 'primary' | 'secondary' | 'subtle' | 'accent' | 'elevated'

interface CardProps extends PropsWithChildren {
  className?: string
  variant?: CardVariant
}

const cardVariantClass: Record<CardVariant, string> = {
  primary: 'card-elevated hover-card bg-white/92',
  secondary: 'glass-panel hover-card',
  subtle: 'surface-secondary hover-card shadow-sm',
  accent: 'accent-panel border-0 text-white',
  elevated: 'card-elevated hover:shadow-xl hover:-translate-y-0.5',
}

export const Card = ({ children, className, variant = 'primary' }: CardProps) => (
  <section
    className={cn(
      'rounded-2xl transition-all duration-200',
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
