import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  message?: string
}

export const EmptyState = ({ title = 'Nothing here yet', message = 'Items will appear here once added.' }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 py-12 text-center">
    <Inbox className="size-10 text-slate-300" />
    <p className="text-sm font-medium text-slate-500">{title}</p>
    <p className="text-xs text-slate-400">{message}</p>
  </div>
)
