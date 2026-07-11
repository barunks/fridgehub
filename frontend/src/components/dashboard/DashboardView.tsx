import {
  AlertTriangle,
  Activity,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Clock,
  MessageSquareText,
  History,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { ViewKey } from '@/types/familyHub'
import { formatDueLabel } from '@/utils/date'
import { cn } from '@/utils/style'

interface DashboardViewProps {
  store: FamilyHubStore
  onNavigate: (view: ViewKey) => void
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  toneClass,
  iconBg,
  onClick,
}: {
  label: string
  value: number | string
  icon: typeof CalendarClock
  toneClass: string
  iconBg: string
  onClick?: () => void
}) => {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      className={cn(
        'group rounded-2xl border border-slate-200/60 bg-white/90 shadow-sm text-left w-full backdrop-blur-sm transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-slate-300/80',
      )}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="flex items-center gap-4 px-5 py-5">
        <div className={cn('flex size-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110', iconBg)}>
          <Icon className={cn('size-5', toneClass)} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
      </div>
    </Wrapper>
  )
}

export const DashboardView = ({ store, onNavigate }: DashboardViewProps) => {
  const { state, stats, toggleTaskStatus, toggleGroceryPurchased } = store
  const insights = state.assistantInsights
  const canManageTasks = store.can('manage_tasks')
  const canManageGroceries = store.can('manage_groceries')
  const completionRate =
    state.tasks.length === 0 ? 0 : Math.round((stats.completedTasks.length / state.tasks.length) * 100)
  const rewardStars = state.members.reduce((total, member) => total + member.points, 0)
  const groceryHealth = state.groceryItems.length === 0
    ? 100
    : Math.max(0, 100 - Math.round((stats.pendingPurchases.length / state.groceryItems.length) * 100))
  const mealHealth = stats.todayMeals.length > 0 ? 100 : 62
  const familyHealth = Math.round(completionRate * 0.45 + groceryHealth * 0.35 + mealHealth * 0.2)

  return (
    <div className="grid gap-6">
      <section className="stagger-children grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card variant="accent" className="animated-gradient-bg overflow-hidden">
          <CardContent className="grid gap-6 p-7 lg:grid-cols-[1fr_auto]">
            <div className="grid content-between gap-8">
              <div>
                <Badge className="border-white/20 bg-white/15 text-white" mode="pill" tone="indigo">
                  Weekly family health
                </Badge>
                <h2 className="mt-4 max-w-xl text-3xl font-bold leading-tight text-white">
                  Command center is tracking the household schedule, meals, groceries, and changes.
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <button className="rounded-2xl bg-white/10 p-4 text-left text-white transition hover:bg-white/20" onClick={() => onNavigate('tasks')} type="button">
                  <CalendarClock className="mb-3 size-5 text-white/75" aria-hidden="true" />
                  <p className="text-2xl font-bold">{stats.todayTasks.length}</p>
                  <p className="text-xs text-white/70">Today reminders</p>
                </button>
                <button className="rounded-2xl bg-white/10 p-4 text-left text-white transition hover:bg-white/20" onClick={() => onNavigate('groceries')} type="button">
                  <ShoppingBag className="mb-3 size-5 text-white/75" aria-hidden="true" />
                  <p className="text-2xl font-bold">{stats.pendingPurchases.length}</p>
                  <p className="text-xs text-white/70">Pending purchases</p>
                </button>
                <button className="rounded-2xl bg-white/10 p-4 text-left text-white transition hover:bg-white/20" onClick={() => onNavigate('meals')} type="button">
                  <ChefHat className="mb-3 size-5 text-white/75" aria-hidden="true" />
                  <p className="text-2xl font-bold">{stats.todayMeals.length}</p>
                  <p className="text-xs text-white/70">Meals today</p>
                </button>
              </div>
            </div>
            <div className="grid place-items-center gap-4">
              <div
                className="grid size-44 place-items-center rounded-full bg-white/15"
                style={{ background: `conic-gradient(rgb(255 255 255) ${familyHealth * 3.6}deg, rgb(255 255 255 / 0.16) 0deg)` }}
              >
                <div className="grid size-32 place-items-center rounded-full bg-indigo-700/80 text-center text-white shadow-xl">
                  <Activity className="mx-auto size-5 text-white/75" aria-hidden="true" />
                  <p className="mt-1 text-4xl font-bold">{familyHealth}</p>
                  <p className="text-[11px] font-semibold uppercase text-white/60">Score</p>
                </div>
              </div>
              <Button className="border-white/20 bg-white/15 text-white hover:bg-white/20" onClick={() => onNavigate('history')} variant="secondary">
                <History className="size-4" aria-hidden="true" />
                Open history
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <StatCard
            icon={AlertTriangle}
            iconBg="bg-rose-50"
            label="Expiring items"
            onClick={() => onNavigate('groceries')}
            toneClass="text-rose-500"
            value={stats.expiringItems.length}
          />
          <StatCard
            icon={Users}
            iconBg="bg-teal-50"
            label="Family members"
            onClick={() => onNavigate('family')}
            toneClass="text-teal-600"
            value={state.members.length}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="stagger-children grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Today</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Agenda, reminders, and progress</p>
              </div>
              <Badge tone="green">{completionRate}% complete</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              {stats.todayTasks.slice(0, 5).map((task) => {
                const member = state.members.find((person) => person.id === task.assignedTo)

                return (
                  <div
                    className="group grid gap-3 rounded-xl border border-slate-100/80 bg-slate-50/50 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm hover:border-slate-200 sm:grid-cols-[1fr_auto]"
                    key={task.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {member && (
                        <Avatar
                          className="size-10"
                          colorClass={member.colorClass}
                          initial={member.initial}
                          label={member.name}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-400">
                          {member?.name ?? 'Unassigned'} - {formatDueLabel(task.dueAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {task.actionLabel && <Badge tone={task.priority === 'high' ? 'rose' : 'indigo'}>{task.actionLabel}</Badge>}
                      <button
                        className={cn(
                          'flex size-9 items-center justify-center rounded-xl border transition-all duration-200',
                          task.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : 'border-slate-200 bg-white text-slate-300 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm',
                        )}
                        disabled={!canManageTasks}
                        onClick={() => toggleTaskStatus(task.id)}
                        title="Toggle complete"
                        type="button"
                      >
                        <CheckCircle2 className="size-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Action Center */}
          <Card variant="secondary">
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <button className="group flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white p-4 text-left transition-all duration-200 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5" onClick={() => onNavigate('tasks')} type="button">
                <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 transition-transform duration-200 group-hover:scale-110">
                  <CalendarClock className="size-5 text-indigo-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Manage tasks</p>
                  <p className="text-[11px] text-slate-400">{stats.todayTasks.length} due today</p>
                </div>
              </button>
              <button className="group flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white p-4 text-left transition-all duration-200 hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5" onClick={() => onNavigate('groceries')} type="button">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 transition-transform duration-200 group-hover:scale-110">
                  <ShoppingBag className="size-5 text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Shop now</p>
                  <p className="text-[11px] text-slate-400">{stats.pendingPurchases.length} pending</p>
                </div>
              </button>
              <button className="group flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white p-4 text-left transition-all duration-200 hover:border-amber-200 hover:shadow-md hover:-translate-y-0.5" onClick={() => onNavigate('meals')} type="button">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-110">
                  <ChefHat className="size-5 text-amber-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Plan meals</p>
                  <p className="text-[11px] text-slate-400">{stats.todayMeals.length} today</p>
                </div>
              </button>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Chores and rewards</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                {state.tasks
                  .filter((task) => task.category === 'chore')
                  .slice(0, 2)
                  .map((task) => {
                    const member = state.members.find((person) => person.id === task.assignedTo)

                    return (
                      <div key={task.id}>
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {member?.name}: {task.title.toLowerCase()}
                          </span>
                          <span className="text-slate-400">{task.status === 'completed' ? 'done' : 'open'}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              'h-2 rounded-full transition-all duration-500',
                              task.status === 'completed' ? 'w-full bg-emerald-500' : 'w-3/4 bg-gradient-to-r from-violet-500 to-indigo-500',
                            )}
                          />
                        </div>
                      </div>
                    )
                  })}
                <p className="text-xs font-medium text-slate-400">{rewardStars} reward points</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Meals</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Plans and recipes</p>
              </CardHeader>
              <CardContent>
                <Badge tone="amber">Dinner suggestion</Badge>
                <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">
                  {stats.todayMeals.find((m) => m.mealType === 'dinner')?.mealName || 'No dinner planned'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {stats.todayMeals.find((m) => m.mealType === 'dinner')?.description || 'Add a meal to your plan'}
                </p>
                <Button className="mt-4 w-full" onClick={() => onNavigate('meals')} variant="secondary">
                  <ChefHat className="size-4" aria-hidden="true" />
                  Open meals
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Groceries</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Lists and expiry</p>
              </CardHeader>
              <CardContent className="grid gap-3">
                {state.groceryItems.slice(0, 3).map((item) => (
                  <label className="group flex cursor-pointer items-start gap-3 text-sm" key={item.id}>
                    <input
                      checked={item.purchased}
                      className="mt-0.5 size-4 rounded-md border-slate-300 text-indigo-600 transition focus:ring-indigo-200"
                      disabled={!canManageGroceries}
                      onChange={() => toggleGroceryPurchased(item.id)}
                      type="checkbox"
                    />
                    <span>
                      <span className={cn('block text-sm font-medium text-slate-800 transition-colors', item.purchased && 'line-through text-slate-400')}>{item.itemName}</span>
                      <span className="block text-xs text-slate-400">{item.notes}</span>
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="stagger-children grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Family Assistant</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Smart recommendations</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50">
                <Sparkles className="size-4 text-indigo-600" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.map((insight) => (
                <button
                  className="group grid gap-2 rounded-xl border border-slate-100/80 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-indigo-200/60 hover:bg-indigo-50/30 hover:shadow-md"
                  key={insight.id}
                  onClick={() => onNavigate('assistant')}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{insight.title}</span>
                    <Badge tone={insight.confidence > 85 ? 'green' : 'indigo'}>{insight.confidence}%</Badge>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">{insight.body}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Announcements</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Shared messages</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state.announcements.map((announcement) => (
                <div className="rounded-xl border border-slate-100/80 bg-slate-50/50 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm" key={announcement.id}>
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="size-4 text-indigo-500" aria-hidden="true" />
                    <p className="text-sm font-semibold text-slate-800">{announcement.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">{announcement.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Family</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Health, events, and roles</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {state.members.map((member) => (
                  <div className="group flex items-center gap-2.5 rounded-xl bg-slate-50/80 p-3 transition-all duration-200 hover:bg-white hover:shadow-sm" key={member.id}>
                    <Avatar className="size-9" colorClass={member.colorClass} initial={member.initial} label={member.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{member.status}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={() => onNavigate('family')} variant="secondary">
                <Users className="size-4" aria-hidden="true" />
                Open family
              </Button>
            </CardContent>
          </Card>

          <Card className="border-indigo-100/60 bg-indigo-50/40">
            <CardContent className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 text-indigo-600" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Task completion</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stats.completedTasks.length} of {state.tasks.length} tasks completed this cycle
                </p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
