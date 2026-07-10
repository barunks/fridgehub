import type { PropsWithChildren } from 'react'
import { cn } from '@/utils/style'

interface CardProps extends PropsWithChildren {
  className?: string
}

export const Card = ({ children, className }: CardProps) => (
  <section className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>{children}</section>
)

export const CardHeader = ({ children, className }: CardProps) => (
  <div className={cn('border-b border-slate-100 px-5 py-4', className)}>{children}</div>
)

export const CardTitle = ({ children, className }: CardProps) => (
  <h2 className={cn('text-base font-semibold text-slate-950', className)}>{children}</h2>
)

export const CardContent = ({ children, className }: CardProps) => (
  <div className={cn('px-5 py-4', className)}>{children}</div>
)
