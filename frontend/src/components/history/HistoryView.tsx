import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Database,
  History,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  ShoppingBasket,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { FridgeHubStore } from '@/hooks/useFridgeHub'
import type { AuditLogEntry } from '@/types/familyHub'
import { cn } from '@/utils/style'

const entityFilters = [
  { value: '', label: 'All history' },
  { value: 'auth_session', label: 'Security' },
  { value: 'task', label: 'Tasks' },
  { value: 'grocery_item', label: 'Groceries' },
  { value: 'grocery_list_type', label: 'Shopping places' },
  { value: 'grocery_purchase_cycle', label: 'Grocery cycles' },
  { value: 'meal_plan', label: 'Meals' },
  { value: 'recipe', label: 'Recipes' },
  { value: 'announcement', label: 'Announcements' },
  { value: 'family_member', label: 'Members' },
  { value: 'emergency_contact', label: 'Contacts' },
  { value: 'notification', label: 'Notifications' },
]

const referenceCards = [
  { label: 'Security', entity: 'auth_session', icon: ShieldCheck, tone: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Tasks', entity: 'task', icon: ClipboardList, tone: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Groceries', entity: 'grocery_item', icon: ShoppingBasket, tone: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Meals', entity: 'meal_plan', icon: CalendarDays, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Family', entity: 'family_member', icon: Users, tone: 'text-teal-600', bg: 'bg-teal-50' },
  { label: 'Announcements', entity: 'announcement', icon: Megaphone, tone: 'text-rose-600', bg: 'bg-rose-50' },
  { label: 'Notifications', entity: 'notification', icon: Bell, tone: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'System data', entity: '', icon: Database, tone: 'text-slate-600', bg: 'bg-slate-50' },
]

const actionLabel = (entry: AuditLogEntry) =>
  (entry.action || 'event')
    .split('_')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')

const entityLabel = (entityType?: string | null) =>
  entityFilters.find((item) => item.value === entityType)?.label || entityType || 'System'

const historyTone = (entry: AuditLogEntry): 'green' | 'amber' | 'rose' | 'indigo' | 'slate' | 'teal' => {
  const action = entry.action || ''
  if (action.includes('failed') || action.includes('delete') || action.includes('revoked')) return 'rose'
  if (action.includes('create') || action.includes('succeeded')) return 'green'
  if (action.includes('update') || action.includes('rotated')) return 'amber'
  if (entry.entityType === 'auth_session') return 'indigo'
  if (entry.entityType?.includes('grocery')) return 'teal'
  return 'slate'
}

export const HistoryView = ({ store }: { store: FridgeHubStore }) => {
  const { auditLogs, loadAuditLogs } = store
  const [entityType, setEntityType] = useState('')
  const page = store.pagination.auditLogs

  useEffect(() => {
    loadAuditLogs(0, entityType || undefined)
  }, [entityType, loadAuditLogs])

  const securityEvents = useMemo(
    () => auditLogs.filter((entry) => entry.entityType === 'auth_session').length,
    [auditLogs],
  )

  const latestEntry = auditLogs[0]

  const loadPage = (offset: number) => {
    loadAuditLogs(offset, entityType || undefined)
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Card variant="accent" className="overflow-hidden">
          <CardContent className="relative grid gap-6 p-7 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg">
                  <History className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-white/70">Audit and history</p>
                  <h2 className="text-2xl font-bold text-white">Every important change in one reference timeline</h2>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-white/75">
                Security, groceries, tasks, meals, family records, announcements, and notifications are recorded by the backend audit log.
              </p>
            </div>
            <div className="grid min-w-64 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-xl backdrop-blur">
              <div>
                <p className="text-xs text-white/60">Loaded entries</p>
                <p className="text-3xl font-bold">{auditLogs.length}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[11px] text-white/60">Security</p>
                  <p className="text-lg font-bold">{securityEvents}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[11px] text-white/60">Page</p>
                  <p className="text-lg font-bold">{Math.floor(page.offset / page.limit) + 1}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Latest Event</CardTitle>
            <p className="mt-1 text-xs text-slate-400">Most recent backend-recorded action</p>
          </CardHeader>
          <CardContent>
            {latestEntry ? (
              <div className="grid gap-3">
                <Badge tone={historyTone(latestEntry)}>{entityLabel(latestEntry.entityType)}</Badge>
                <div>
                  <p className="text-lg font-bold text-slate-900">{actionLabel(latestEntry)}</p>
                  <p className="text-xs text-slate-400">{new Date(latestEntry.createdAt).toLocaleString()}</p>
                </div>
                {latestEntry.ipAddress && (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">IP address: {latestEntry.ipAddress}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No audit entries loaded yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card variant="subtle">
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-2">
            {entityFilters.map((filter) => (
              <button
                className={cn(
                  'soft-pill min-h-10 px-4 text-sm font-semibold transition-all',
                  entityType === filter.value
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300 hover:text-slate-700',
                )}
                key={filter.value || 'all'}
                onClick={() => setEntityType(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button onClick={() => loadAuditLogs(page.offset, entityType || undefined)} variant="secondary">
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid gap-3 self-start">
          {referenceCards.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={cn(
                  'hover-card flex items-center gap-3 rounded-2xl border px-4 py-3 text-left',
                  entityType === item.entity ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-200/80 bg-white/80',
                )}
                key={`${item.label}-${item.entity}`}
                onClick={() => setEntityType(item.entity)}
                type="button"
              >
                <span className={cn('flex size-10 items-center justify-center rounded-xl', item.bg)}>
                  <Icon className={cn('size-4', item.tone)} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                  <span className="block text-[11px] text-slate-400">Reference timeline</span>
                </span>
              </button>
            )
          })}
        </div>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Timeline</CardTitle>
              <p className="mt-1 text-xs text-slate-400">{entityType ? entityLabel(entityType) : 'All backend audit events'}</p>
            </div>
            <Badge tone="indigo">{auditLogs.length} rows</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {auditLogs.length === 0 ? (
              <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center">
                <div>
                  <History className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">No history for this filter</p>
                  <p className="mt-1 text-xs text-slate-400">Try another reference area or refresh the timeline.</p>
                </div>
              </div>
            ) : (
              auditLogs.map((entry) => (
                <article className="hover-card rounded-2xl border border-slate-100 bg-white p-4" key={entry.id}>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={historyTone(entry)}>{entityLabel(entry.entityType)}</Badge>
                        <p className="font-bold text-slate-900">{actionLabel(entry)}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.entityId ? `Record ${entry.entityId} - ` : ''}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {entry.userId && <Badge tone="slate">User {entry.userId}</Badge>}
                      {entry.ipAddress && <Badge tone="slate">{entry.ipAddress}</Badge>}
                    </div>
                  </div>
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <pre className="mt-3 max-h-32 overflow-auto rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                      {JSON.stringify(entry.changes, null, 2)}
                    </pre>
                  )}
                </article>
              ))
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500">
                Page {Math.floor(page.offset / page.limit) + 1} - {auditLogs.length} loaded
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={page.offset === 0 || page.isLoading}
                  onClick={() => loadPage(page.offset - page.limit)}
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  disabled={!page.hasNext || page.isLoading}
                  onClick={() => loadPage(page.offset + page.limit)}
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
