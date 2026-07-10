import { useState, type PropsWithChildren } from 'react'
import {
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  Settings2,
  ShoppingBasket,
  Users,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { NavItem, ViewKey } from '@/types/familyHub'
import { formatFullDate } from '@/utils/date'
import { cn } from '@/utils/style'

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Home', icon: Home },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList },
  { key: 'groceries', label: 'Groceries', icon: ShoppingBasket },
  { key: 'meals', label: 'Meals', icon: CalendarDays },
  { key: 'family', label: 'Family', icon: Users },
  { key: 'assistant', label: 'Ask AI', icon: Bot },
  { key: 'implementation', label: 'Build', icon: Settings2 },
]

interface AppShellProps extends PropsWithChildren {
  activeView: ViewKey
  onNavigate: (view: ViewKey) => void
  store: FamilyHubStore
}

export const AppShell = ({ activeView, onNavigate, store, children }: AppShellProps) => {
  const { state, stats, markNotificationRead } = store
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-slate-900 px-5 py-6 text-white lg:block">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-blue-600">
            <LayoutDashboard className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-semibold">{state.family.familyName}</p>
            <p className="text-sm text-slate-300">Command center</p>
          </div>
        </div>

        <nav className="mt-9 grid gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activeView === item.key

            return (
              <button
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-lg px-4 text-left text-sm font-semibold transition',
                  active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/20' : 'text-slate-300 hover:bg-slate-800',
                )}
                key={item.key}
                onClick={() => onNavigate(item.key)}
                title={item.label}
                type="button"
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="mt-10 rounded-lg bg-slate-800 p-4">
          <p className="text-sm font-semibold">Emergency numbers</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            {state.emergencyContacts.map((contact) => (
              <div className="flex items-center justify-between" key={contact.id}>
                <span>{contact.label}</span>
                <span className="font-semibold text-white">{contact.value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/86 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">{formatFullDate()}</p>
              <h1 className="truncate text-2xl font-semibold text-slate-950 sm:text-3xl">
                Good morning, Family
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="blue">{stats.todayTasks.length} reminders</Badge>
              <Badge tone="amber">{stats.pendingPurchases.length} purchases</Badge>
              {store.isLoading && <Badge tone="slate">Syncing</Badge>}
              <Button
                className="px-3"
                onClick={() => setNotificationsOpen((open) => !open)}
                title="Notifications"
                variant="secondary"
              >
                <Bell className="size-4" aria-hidden="true" />
                <span className="sr-only">Notifications</span>
              </Button>
              <Button variant="secondary" onClick={() => onNavigate('assistant')} title="Ask AI">
                <Bot className="size-4" aria-hidden="true" />
                Ask AI
              </Button>
              <Button className="hidden sm:inline-flex" variant="secondary" onClick={() => onNavigate('implementation')} title="Build">
                <Settings2 className="size-4" aria-hidden="true" />
                Build
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>

      {store.feedback && (
        <div
          className={cn(
            'fixed right-4 top-24 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl',
            store.feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          )}
          role="status"
        >
          <span className="leading-6">{store.feedback.message}</span>
          <button
            className="rounded-md p-1 transition hover:bg-white/60"
            onClick={store.clearFeedback}
            title="Dismiss"
            type="button"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {notificationsOpen && (
        <section className="fixed right-4 top-28 z-40 w-[calc(100vw-2rem)] max-w-80 rounded-lg border border-slate-200 bg-white shadow-xl xl:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-blue-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-950">Notifications</p>
            </div>
            <Badge tone="rose">{stats.unreadNotifications.length} unread</Badge>
          </div>
          <div className="max-h-72 overflow-auto p-3 scrollbar-thin">
            {state.notifications.slice(0, 5).map((notification) => (
              <button
                className={cn(
                  'mb-2 grid w-full gap-1 rounded-lg border p-3 text-left transition hover:bg-slate-50',
                  notification.isRead ? 'border-slate-100 bg-white' : 'border-blue-100 bg-blue-50/60',
                )}
                key={notification.id}
                onClick={() => {
                  markNotificationRead(notification.id)
                  setNotificationsOpen(false)
                }}
                type="button"
              >
                <span className="text-sm font-semibold text-slate-900">{notification.title}</span>
                <span className="text-xs leading-5 text-slate-500">{notification.message}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="fixed bottom-24 right-4 z-30 hidden w-80 rounded-lg border border-slate-200 bg-white shadow-xl xl:block">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-blue-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-950">Notifications</p>
          </div>
          <Badge tone="rose">{stats.unreadNotifications.length} unread</Badge>
        </div>
        <div className="max-h-72 overflow-auto p-3 scrollbar-thin">
          {state.notifications.slice(0, 4).map((notification) => (
            <button
              className={cn(
                'mb-2 grid w-full gap-1 rounded-lg border p-3 text-left transition hover:bg-slate-50',
                notification.isRead ? 'border-slate-100 bg-white' : 'border-blue-100 bg-blue-50/60',
              )}
              key={notification.id}
              onClick={() => markNotificationRead(notification.id)}
              type="button"
            >
              <span className="text-sm font-semibold text-slate-900">{notification.title}</span>
              <span className="text-xs leading-5 text-slate-500">{notification.message}</span>
            </button>
          ))}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const active = activeView === item.key

          return (
            <button
              className={cn(
                'grid min-h-14 place-items-center gap-1 rounded-lg text-[11px] font-semibold transition',
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-500',
              )}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              title={item.label}
              type="button"
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="fixed right-4 top-3 z-30 flex items-center gap-2 lg:hidden">
        <button
          className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
          onClick={() => onNavigate('implementation')}
          title="Build"
          type="button"
        >
          <Settings2 className="size-4" aria-hidden="true" />
        </button>
        {state.members.slice(0, 3).map((member) => (
          <Avatar
            className="size-8 border-2 border-white text-xs shadow-sm"
            colorClass={member.colorClass}
            initial={member.initial}
            key={member.id}
            label={member.name}
          />
        ))}
      </div>
    </div>
  )
}
