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
      'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
      colorClass,
      className,
    )}
  >
    {initial}
  </span>
)
