import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Clock,
  MessageSquareText,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import { generateAssistantInsights } from '@/services/assistantEngine'
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
  onClick,
}: {
  label: string
  value: number | string
  icon: typeof CalendarClock
  toneClass: string
  onClick?: () => void
}) => {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-sm text-left w-full',
        onClick && 'cursor-pointer transition hover:border-blue-300 hover:shadow-md',
      )}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div className={cn('flex size-12 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </Wrapper>
  )
}

export const DashboardView = ({ store, onNavigate }: DashboardViewProps) => {
  const { state, stats, toggleTaskStatus, toggleGroceryPurchased } = store
  const insights = generateAssistantInsights(state)
  const completionRate =
    state.tasks.length === 0 ? 0 : Math.round((stats.completedTasks.length / state.tasks.length) * 100)
  const rewardStars = state.members.reduce((total, member) => total + member.points, 0)

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarClock}
          label="Tasks today"
          onClick={() => onNavigate('tasks')}
          toneClass="bg-blue-50 text-blue-600"
          value={stats.todayTasks.length}
        />
        <StatCard
          icon={ShoppingBag}
          label="Pending purchases"
          onClick={() => onNavigate('groceries')}
          toneClass="bg-amber-50 text-amber-600"
          value={stats.pendingPurchases.length}
        />
        <StatCard
          icon={AlertTriangle}
          label="Expiring items"
          onClick={() => onNavigate('groceries')}
          toneClass="bg-rose-50 text-rose-600"
          value={stats.expiringItems.length}
        />
        <StatCard
          icon={ChefHat}
          label="Meals today"
          onClick={() => onNavigate('meals')}
          toneClass="bg-emerald-50 text-emerald-600"
          value={stats.todayMeals.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Today</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Agenda, reminders, traffic, and weather risk</p>
              </div>
              <Badge tone="green">{completionRate}% complete</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              {stats.todayTasks.slice(0, 5).map((task) => {
                const member = state.members.find((person) => person.id === task.assignedTo)

                return (
                  <div
                    className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_auto]"
                    key={task.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {member && (
                        <Avatar
                          className="size-11"
                          colorClass={member.colorClass}
                          initial={member.initial}
                          label={member.name}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{task.title}</p>
                        <p className="text-sm text-slate-500">
                          {member?.name ?? 'Unassigned'} - {formatDueLabel(task.dueAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {task.actionLabel && <Badge tone={task.priority === 'high' ? 'rose' : 'blue'}>{task.actionLabel}</Badge>}
                      <button
                        className={cn(
                          'flex size-9 items-center justify-center rounded-md border transition',
                          task.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : 'border-slate-200 bg-white text-slate-400 hover:text-blue-600',
                        )}
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

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Chores and rewards</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                {state.tasks
                  .filter((task) => task.category === 'chore')
                  .slice(0, 2)
                  .map((task) => {
                    const member = state.members.find((person) => person.id === task.assignedTo)

                    return (
                      <div key={task.id}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-800">
                            {member?.name}: {task.title.toLowerCase()}
                          </span>
                          <span className="text-slate-400">{task.status === 'completed' ? 'done' : 'open'}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className={cn(
                              'h-2 rounded-full',
                              task.status === 'completed' ? 'w-full bg-emerald-500' : 'w-3/4 bg-violet-500',
                            )}
                          />
                        </div>
                      </div>
                    )
                  })}
                <p className="text-sm text-slate-500">Rewards: {rewardStars} stars</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Meals</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Plans and recipes</p>
              </CardHeader>
              <CardContent>
                <Badge tone="amber">Dinner suggestion</Badge>
                <p className="mt-3 text-xl font-semibold text-slate-950">
                  {stats.todayMeals.find((m) => m.mealType === 'dinner')?.mealName || 'No dinner planned'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
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
                <p className="mt-1 text-sm text-slate-500">Lists and expiry</p>
              </CardHeader>
              <CardContent className="grid gap-3">
                {state.groceryItems.slice(0, 3).map((item) => (
                  <label className="flex items-start gap-3 text-sm" key={item.id}>
                    <input
                      checked={item.purchased}
                      className="mt-1 size-4 rounded border-slate-300 text-blue-600"
                      onChange={() => toggleGroceryPurchased(item.id)}
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{item.itemName}</span>
                      <span className="block text-slate-500">{item.notes}</span>
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Family Assistant</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Smart recommendations</p>
              </div>
              <Sparkles className="size-5 text-blue-600" aria-hidden="true" />
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.map((insight) => (
                <button
                  className="grid gap-2 rounded-lg border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                  key={insight.id}
                  onClick={() => onNavigate('assistant')}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-950">{insight.title}</span>
                    <Badge tone={insight.confidence > 85 ? 'green' : 'blue'}>{insight.confidence}%</Badge>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{insight.body}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Family Announcements</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Shared messages</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state.announcements.map((announcement) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={announcement.id}>
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="size-4 text-blue-600" aria-hidden="true" />
                    <p className="font-semibold text-slate-900">{announcement.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{announcement.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Family</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Health, events, and roles</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {state.members.map((member) => (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3" key={member.id}>
                    <Avatar colorClass={member.colorClass} initial={member.initial} label={member.name} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{member.name}</p>
                      <p className="truncate text-xs text-slate-500">{member.status}</p>
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

          <Card className="border-blue-100 bg-blue-50/60">
            <CardContent className="flex items-start gap-3">
              <Clock className="mt-1 size-5 text-blue-600" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-950">Task completion</p>
                <p className="text-sm text-slate-600">
                  {stats.completedTasks.length} of {state.tasks.length} tasks completed this cycle.
                </p>
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-sky-500 transition-all"
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
