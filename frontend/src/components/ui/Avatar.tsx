import { cn } from '@/utils/style'

interface AvatarProps {
  initial: string
  colorClass: string
  label: string
  className?: string
}

export const Avatar = ({ initial, colorClass, label, className }: AvatarProps) => (
  <span
    aria-label={label}
    className={cn(
      'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/80 shadow-sm transition-transform duration-200 hover:scale-105',
      colorClass,
      className,
    )}
  >
    {initial}
  </span>
)
