import { cn } from '@/utils/style'

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-slate-700', className)} />
)

export const CardSkeleton = () => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <Skeleton className="mb-3 h-4 w-1/3" />
    <Skeleton className="mb-2 h-3 w-full" />
    <Skeleton className="h-3 w-2/3" />
  </div>
)

export const DashboardSkeleton = () => (
  <div className="grid gap-5">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={i}>
          <Skeleton className="size-12 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-10" />
          </div>
        </div>
      ))}
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  </div>
)
