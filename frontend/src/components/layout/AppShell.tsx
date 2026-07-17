import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  Bot,
  CheckCheck,
  Flame,
  LayoutDashboard,
  LogOut,
  Moon,
  Phone,
  Search,
  Shield,
  Sun,
  Sunrise,
  Sunset,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { ThemeMode } from '@/hooks/useTheme'
import { navItems } from '@/navigation'
import type { ScopedNavigationOptions, ViewKey } from '@/types/familyHub'
import { formatFullDate, todayIso } from '@/utils/date'
import { cn } from '@/utils/style'

interface AppShellProps extends PropsWithChildren {
  activeView: ViewKey
  onLogout: () => void
  onNavigate: (view: ViewKey, options?: ScopedNavigationOptions) => void
  onToggleTheme: () => void
  store: FamilyHubStore
  theme: ThemeMode
  username: string | null
}

export const AppShell = ({ activeView, onLogout, onNavigate, onToggleTheme, store, theme, username, children }: AppShellProps) => {
  const { state, stats, markAllNotificationsRead, markNotificationRead } = store
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode'
  const currentMember = state.members.find((member) => member.id === store.currentUserId)
  const displayName = currentMember?.name || username || 'Family'
  const timeContext = useMemo(() => {
    const now = new Date()
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: state.family.timezone || undefined,
      }).format(now),
    )
    const homeBase = state.family.homeBase || 'Singapore'
    let greeting: string
    let timeIcon: typeof Sun
    let iconClass: string
    let bgAccent: string

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning'
      timeIcon = Sunrise
      iconClass = 'time-icon-morning text-amber-400'
      bgAccent = 'from-amber-100/60 via-orange-50/40 to-transparent'
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon'
      timeIcon = Sun
      iconClass = 'time-icon-morning text-yellow-500'
      bgAccent = 'from-yellow-100/50 via-amber-50/30 to-transparent'
    } else if (hour >= 17 && hour < 20) {
      greeting = 'Good evening'
      timeIcon = Sunset
      iconClass = 'time-icon-morning text-orange-500'
      bgAccent = 'from-orange-100/50 via-rose-50/30 to-transparent'
    } else {
      greeting = 'Good night'
      timeIcon = Moon
      iconClass = 'time-icon-night text-indigo-300'
      bgAccent = 'from-indigo-100/50 via-violet-50/30 to-transparent'
    }

    return { greeting, timeIcon, iconClass, bgAccent, homeBase, hour }
  }, [state.family.homeBase, state.family.timezone])
  const greetingText = timeContext.greeting
  const TimeIcon = timeContext.timeIcon
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
    <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <div className="pointer-events-none fixed inset-0 -z-10 animated-gradient-bg bg-[linear-gradient(135deg,rgba(79,70,229,0.06),transparent_32%),linear-gradient(225deg,rgba(20,184,166,0.08),transparent_36%),linear-gradient(315deg,rgba(139,92,246,0.04),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(241,245,249,0.48))]" style={{ backgroundSize: '200% 200%' }} />
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
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 text-rose-400" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Emergency</p>
            </div>
            <div className="mt-3 grid gap-2">
              {state.emergencyContacts.map((contact) => {
                const colorMap: Record<string, { bg: string; border: string; icon: typeof Shield; pulseColor: string }> = {
                  Ambulance: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', icon: Phone, pulseColor: '244 63 94' },
                  Police: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', icon: Shield, pulseColor: '59 130 246' },
                  Fire: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', icon: Flame, pulseColor: '249 115 22' },
                }
                const style = colorMap[contact.label] || colorMap.Ambulance
                const ContactIcon = style.icon

                return (
                  <div
                    className={cn(
                      'emergency-card group flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer',
                      style.bg,
                      style.border,
                    )}
                    key={contact.id}
                    style={{ '--pulse-color': style.pulseColor } as React.CSSProperties}
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 transition-transform duration-200 group-hover:scale-110">
                      <ContactIcon className="size-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="emergency-label block text-[11px] font-medium text-slate-400 transition-colors group-hover:text-white">{contact.label}</span>
                      <span className="emergency-number block text-lg font-bold text-white tracking-wide">{contact.value}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TimeIcon className={cn('size-5', timeContext.iconClass)} aria-hidden="true" />
                <p className="text-xs font-medium tracking-wide text-slate-400">{formatFullDate(todayIso(state.family.timezone))} · {timeContext.homeBase}</p>
              </div>
              <h1 className="greeting-animated truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {greetingText}, {displayName}
              </h1>
            </div>

            <div className="surface-secondary flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
              <Badge mode="pill" tone="indigo">{stats.todayTasks.length} reminders</Badge>
              <Badge mode="pill" tone="amber">{stats.pendingPurchases.length} purchases</Badge>
              <Badge mode="pill" tone="green">{state.members.length} members</Badge>
              {store.isLoading && <Badge mode="pill" tone="slate">Syncing</Badge>}
              {store.isOffline && <Badge tone="rose">{store.isBrowserOffline ? 'Offline' : 'API unavailable'}</Badge>}
              <Button
                className="hidden gap-2 px-3 sm:inline-flex"
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                title="Search (Ctrl K)"
                variant="secondary"
              >
                <Search className="size-4" aria-hidden="true" />
                <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Ctrl K</kbd>
              </Button>
              <Button iconOnly onClick={onToggleTheme} title={themeLabel} variant="icon">
                <ThemeIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">{themeLabel}</span>
              </Button>
              <Button
                className="relative"
                iconOnly
                onClick={() => setNotificationsOpen((open) => !open)}
                title="Notifications"
                variant="icon"
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
                <Button
                  disabled={stats.unreadNotifications.length === 0}
                  onClick={markAllNotificationsRead}
                  variant="outline"
                >
                  <CheckCheck className="size-4" aria-hidden="true" />
                  Mark all read
                </Button>
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
                <div className="stagger-children grid gap-2.5">
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
