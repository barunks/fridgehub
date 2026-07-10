import { useEffect, useState, type PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  Bot,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Settings2,
  Sun,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { ThemeMode } from '@/hooks/useTheme'
import { navItems } from '@/navigation'
import type { ViewKey } from '@/types/familyHub'
import { formatFullDate } from '@/utils/date'
import { cn } from '@/utils/style'

interface AppShellProps extends PropsWithChildren {
  activeView: ViewKey
  onLogout: () => void
  onNavigate: (view: ViewKey) => void
  onToggleTheme: () => void
  store: FamilyHubStore
  theme: ThemeMode
  username: string | null
}

export const AppShell = ({ activeView, onLogout, onNavigate, onToggleTheme, store, theme, username, children }: AppShellProps) => {
  const { state, stats, markNotificationRead } = store
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode'

  // Escape key dismisses notifications and toast
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotificationsOpen(false)
        store.clearFeedback()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [store])

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
              <NavLink
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-lg px-4 text-left text-sm font-semibold transition',
                  active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/20' : 'text-slate-300 hover:bg-slate-800',
                )}
                key={item.key}
                title={item.label}
                to={item.path}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
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
                className="hidden gap-2 px-3 sm:inline-flex"
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                title="Search (⌘K)"
                variant="secondary"
              >
                <Search className="size-4" aria-hidden="true" />
                <kbd className="rounded border border-slate-200 px-1 py-0.5 text-[10px] font-medium text-slate-400">⌘K</kbd>
              </Button>
              <Button className="px-3" onClick={onToggleTheme} title={themeLabel} variant="secondary">
                <ThemeIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">{themeLabel}</span>
              </Button>
              <Button
                className="relative px-3"
                onClick={() => setNotificationsOpen((open) => !open)}
                title="Notifications"
                variant="secondary"
              >
                <Bell className="size-4" aria-hidden="true" />
                {stats.unreadNotifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {stats.unreadNotifications.length}
                  </span>
                )}
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
              {username && (
                <Button className="hidden sm:inline-flex" variant="secondary" onClick={onLogout} title="Sign out">
                  <LogOut className="size-4" aria-hidden="true" />
                  {username}
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>

      {/* Toast feedback */}
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

      {/* Notification slide-out panel — right side */}
      {notificationsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setNotificationsOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-950">Notifications</h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="rose">{stats.unreadNotifications.length} unread</Badge>
                <button
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setNotificationsOpen(false)}
                  title="Close"
                  type="button"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 scrollbar-thin">
              {state.notifications.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">No notifications yet</p>
              ) : (
                <div className="grid gap-2">
                  {state.notifications.map((notification) => (
                    <button
                      className={cn(
                        'grid w-full gap-1 rounded-lg border p-4 text-left transition hover:bg-slate-50',
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
              )}
            </div>
          </aside>
        </>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] lg:hidden">
        {navItems.slice(0, 6).map((item) => {
          const Icon = item.icon
          const active = activeView === item.key

          return (
            <NavLink
              className={cn(
                'grid min-h-14 place-items-center gap-1 rounded-lg text-[11px] font-semibold transition',
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-500',
              )}
              key={item.key}
              title={item.label}
              to={item.path}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Mobile top-right avatars */}
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
