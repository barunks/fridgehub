import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

interface CardProps extends PropsWithChildren {
  className?: string
}

export const Card = ({ children, className }: CardProps) => (
  <section
    className={cn(
      'rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md hover:border-slate-200',
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
