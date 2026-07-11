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
  const currentMember = state.members.find((member) => member.id === store.currentUserId)
  const displayName = currentMember?.name || username || 'Family'
  const hour = Number(new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: false }).format(new Date()))
  const greetingText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const visibleNavItems = navItems.filter((item) => !item.requiredPermission || store.can(item.requiredPermission))

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
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="hidden border-r border-slate-800/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-5 py-7 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
            <LayoutDashboard className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">{state.family.familyName}</p>
            <p className="text-xs font-medium text-slate-400">Command center</p>
          </div>
        </div>

        <nav className="mt-10 grid gap-1.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const active = activeView === item.key

            return (
              <NavLink
                className={cn(
                  'group flex min-h-11 items-center gap-3 rounded-xl px-4 text-left text-[13px] font-semibold transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
                )}
                key={item.key}
                title={item.label}
                to={item.path}
              >
                <Icon className={cn('size-[18px] transition-transform duration-200', !active && 'group-hover:scale-110')} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto pt-8">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Emergency</p>
            <div className="mt-3 grid gap-2.5 text-[13px] text-slate-300">
              {state.emergencyContacts.map((contact) => (
                <div className="flex items-center justify-between" key={contact.id}>
                  <span className="text-slate-400">{contact.label}</span>
                  <span className="font-semibold text-white">{contact.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/90 px-4 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-slate-400">{formatFullDate()}</p>
              <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {greetingText}, {displayName} 👋
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="indigo">{stats.todayTasks.length} reminders</Badge>
              <Badge tone="amber">{stats.pendingPurchases.length} purchases</Badge>
              {store.isLoading && <Badge tone="slate">Syncing…</Badge>}
              {store.isOffline && <Badge tone="rose">{store.isBrowserOffline ? 'Offline' : 'API unavailable'}</Badge>}
              <Button
                className="hidden gap-2 px-3 sm:inline-flex"
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                title="Search (⌘K)"
                variant="secondary"
              >
                <Search className="size-4" aria-hidden="true" />
                <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">⌘K</kbd>
              </Button>
              <Button className="px-3" onClick={onToggleTheme} title={themeLabel} variant="ghost">
                <ThemeIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">{themeLabel}</span>
              </Button>
              <Button
                className="relative px-3"
                onClick={() => setNotificationsOpen((open) => !open)}
                title="Notifications"
                variant="ghost"
              >
                <Bell className="size-4" aria-hidden="true" />
                {stats.unreadNotifications.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-[10px] font-bold text-white shadow-sm shadow-rose-500/30">
                    {stats.unreadNotifications.length}
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
              {store.can('use_assistant') && (
                <Button variant="secondary" onClick={() => onNavigate('assistant')} title="Ask AI">
                  <Bot className="size-4" aria-hidden="true" />
                  Ask AI
                </Button>
              )}
              {store.can('view_implementation') && (
                <Button className="hidden sm:inline-flex" variant="ghost" onClick={() => onNavigate('implementation')} title="Build">
                  <Settings2 className="size-4" aria-hidden="true" />
                </Button>
              )}
              {username && (
                <Button className="hidden sm:inline-flex" variant="ghost" onClick={onLogout} title="Sign out">
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="text-xs">{username}</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="animate-fade-in-up px-4 py-6 lg:px-8 lg:py-8">
          {store.isOffline && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {store.isBrowserOffline
                ? 'You are offline. Changes are disabled until the browser reconnects.'
                : 'The FamilyHub API is unavailable. Data shown here may be stale.'}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Toast feedback */}
      {store.feedback && (
        <div
          className={cn(
            'fixed right-4 top-24 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 text-sm shadow-xl animate-slide-in-right backdrop-blur-sm',
            store.feedback.type === 'success'
              ? 'border-emerald-200/60 bg-emerald-50/90 text-emerald-800'
              : 'border-rose-200/60 bg-rose-50/90 text-rose-800',
          )}
          role="status"
        >
          <span className="leading-6">{store.feedback.message}</span>
          <button
            className="rounded-lg p-1.5 transition-colors hover:bg-white/60"
            onClick={store.clearFeedback}
            title="Dismiss"
            type="button"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Notification slide-out panel */}
      {notificationsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setNotificationsOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur-xl animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Bell className="size-4" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-bold tracking-tight text-slate-900">Notifications</h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="rose">{stats.unreadNotifications.length} unread</Badge>
                <button
                  className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setNotificationsOpen(false)}
                  title="Close"
                  type="button"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 scrollbar-thin">
              {state.notifications.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-400">No notifications yet</p>
              ) : (
                <div className="grid gap-2.5">
                  {state.notifications.map((notification) => (
                    <button
                      className={cn(
                        'grid w-full gap-1.5 rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-sm hover:scale-[1.01]',
                        notification.isRead
                          ? 'border-slate-100/80 bg-white hover:bg-slate-50'
                          : 'border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/60',
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
      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-slate-200/60 bg-white/90 px-2 py-2.5 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const active = activeView === item.key

          return (
            <NavLink
              className={cn(
                'grid min-h-14 min-w-[4.5rem] flex-1 place-items-center gap-1 rounded-xl text-[10px] font-semibold transition-all duration-200',
                active
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600',
              )}
              key={item.key}
              title={item.label}
              to={item.path}
            >
              <Icon className={cn('size-5 transition-transform', active && 'scale-110')} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Mobile top-right avatars */}
      <div className="fixed right-4 top-3 z-30 flex items-center gap-1.5 lg:hidden">
        {store.can('view_implementation') && (
          <button
            className="flex size-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm backdrop-blur-sm transition-all hover:scale-105"
            onClick={() => onNavigate('implementation')}
            title="Build"
            type="button"
          >
            <Settings2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
        {state.members.slice(0, 3).map((member) => (
          <Avatar
            className="size-7 border-2 border-white text-[10px] shadow-sm"
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
