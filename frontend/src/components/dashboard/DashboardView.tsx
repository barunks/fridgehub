import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  ClipboardList,
  PackageCheck,
  ShoppingBasket,
  ShoppingCart,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { FridgeHubStore } from '@/hooks/useFridgeHub'
import type {
  GroceryCycle,
  FamilyMember,
  GroceryItem,
  GroceryListType,
  MealType,
  MealPlanItem,
  ScopedNavigationOptions,
  ShoppingCycleItem,
  Task,
  TimeScope,
  ViewKey,
} from '@/types/familyHub'
import type { LucideIcon } from 'lucide-react'
import {
  formatCompactDate,
  formatDueLabel,
  formatFullDate,
  isIsoDateInRange,
  isoDateRangesOverlap,
  nextRecurringOccurrenceInRange,
  todayIso,
  weekEndIso,
  weekStartIso,
} from '@/utils/date'
import { cn } from '@/utils/style'

interface DashboardViewProps {
  store: FridgeHubStore
  onNavigate: (view: ViewKey, options?: ScopedNavigationOptions) => void
}

type DetailSelection =
  | { kind: 'task'; id: number }
  | { kind: 'meal'; key: string }
  | { kind: 'grocery'; key: string }

type ShoppingDashboardRow = {
  cycle?: GroceryCycle
  grocery?: GroceryItem
  item: ShoppingCycleItem
  key: string
  listType?: GroceryListType
  source: 'shopping'
}

type MasterGroceryDashboardRow = {
  item: GroceryItem
  key: string
  listType?: GroceryListType
  source: 'master'
}

type GroceryDashboardRow = ShoppingDashboardRow | MasterGroceryDashboardRow

type DashboardTask = {
  occurrenceDueAt: string
  occurrenceIso: string
  task: Task
}

type DashboardMeal = {
  audience?: FamilyMember
  displayDate: string
  isPersonalized: boolean
  meal: MealPlanItem
}

type DashboardMealGroup = {
  date: string
  familyMeal?: DashboardMeal
  key: string
  mealType: MealType
  meals: DashboardMeal[]
  personalMeals: DashboardMeal[]
}

type NoticeTone = 'amber' | 'green' | 'indigo' | 'rose'

type DashboardNotice = {
  body: string
  category: string
  icon: LucideIcon
  key: string
  onClick?: () => void
  title: string
  tone: NoticeTone
}

type AttentionGroup = {
  body: string
  count: number
  icon: LucideIcon
  key: string
  label: string
  tone: NoticeTone
}

const priorityWeight: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const mealSlotLabel: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

const mealSlotOrder: MealType[] = ['breakfast', 'lunch', 'snacks', 'dinner']

const mealTypeWeight: Record<MealPlanItem['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  snacks: 2,
  dinner: 3,
}

const scopeOptions: Array<{ label: string; value: TimeScope }> = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
]

const scopeLabel = (scope: TimeScope) => (scope === 'today' ? 'today' : 'this week')

const emptyMessage = (label: string, scope: TimeScope) => `No ${label.toLowerCase()} for ${scopeLabel(scope)}.`

const occurrenceDateTime = (dateTime: string, occurrenceIso: string) => `${occurrenceIso}${dateTime.slice(10)}`

const mealDisplayDate = (meal: MealPlanItem) => meal.planDate

const InfoPair = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
    <p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
  </div>
)

const parseStructuredText = (value?: string | null) => {
  const text = value?.trim()
  if (!text) return null

  const ordered = Array.from(text.matchAll(/(?:^|\s)(\d+)[.)]\s+(.+?)(?=(?:\s+\d+[.)]\s+)|$)/g))
    .sort((left, right) => Number(left[1]) - Number(right[1]))
    .map((match) => match[2].trim())
    .filter(Boolean)
  if (ordered.length > 1) {
    return { items: ordered, type: 'ordered' as const }
  }

  const bulletLines = text
    .split(/\n+/)
    .map((line) => line.trim())
  if (bulletLines.length > 1 && bulletLines.every((line) => /^[-*•]\s+/.test(line))) {
    return {
      items: bulletLines.map((line) => line.replace(/^[-*•]\s+/, '')).filter(Boolean),
      type: 'unordered' as const,
    }
  }

  const commaItems = text.split(/\s*,\s*/).map((item) => item.trim()).filter(Boolean)
  if (commaItems.length > 3 && commaItems.every((item) => item.length <= 40)) {
    return { items: commaItems, type: 'unordered' as const }
  }

  const semicolonItems = text.split(/\s*;\s*/).map((item) => item.trim()).filter(Boolean)
  if (semicolonItems.length > 2 && semicolonItems.every((item) => item.length <= 50)) {
    return { items: semicolonItems, type: 'unordered' as const }
  }

  return null
}

const StructuredText = ({
  className,
  empty,
  value,
}: {
  className?: string
  empty?: string
  value?: string | null
}) => {
  const structured = parseStructuredText(value)
  if (!value?.trim()) {
    return <p className={className}>{empty ?? 'No details added.'}</p>
  }

  if (!structured) {
    return <p className={className}>{value}</p>
  }

  const List = structured.type === 'ordered' ? 'ol' : 'ul'
  return (
    <List className={cn('grid gap-1 pl-5', structured.type === 'ordered' ? 'list-decimal' : 'list-disc', className)}>
      {structured.items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </List>
  )
}

const SectionEmpty = ({ children }: { children: string }) => (
  <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center">
    <p className="text-sm font-semibold text-slate-400">{children}</p>
  </div>
)

const noticeToneClass: Record<NoticeTone, string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
}

export const DashboardView = ({ store, onNavigate }: DashboardViewProps) => {
  const { state, toggleTaskStatus, toggleGroceryPurchased, updateShoppingItem } = store
  const [scope, setScope] = useState<TimeScope>('today')
  const [selected, setSelected] = useState<DetailSelection | null>(null)
  const [attentionOpen, setAttentionOpen] = useState(false)
  const canManageTasks = store.can('manage_tasks')
  const canManageGroceries = store.can('manage_groceries')
  const currentMember = state.members.find((member) => member.id === store.currentUserId)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAttentionOpen(false)
        setSelected(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const range = useMemo(() => {
    const familyToday = todayIso(state.family.timezone)
    const currentWeekStartIso = weekStartIso(familyToday)

    if (scope === 'today') {
      return {
        currentWeekStartIso,
        endIso: familyToday,
        startIso: familyToday,
      }
    }

    return {
      currentWeekStartIso,
      endIso: weekEndIso(familyToday),
      startIso: currentWeekStartIso,
    }
  }, [scope, state.family.timezone])

  const listTypeById = useMemo(() => new Map(state.listTypes.map((listType) => [listType.id, listType])), [state.listTypes])
  const cycleById = useMemo(() => new Map(state.groceryCycles.map((cycle) => [cycle.id, cycle])), [state.groceryCycles])
  const groceryById = useMemo(() => new Map(state.groceryItems.map((item) => [item.id, item])), [state.groceryItems])

  const tasksInScope = useMemo<DashboardTask[]>(() => {
    return state.tasks
      .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
      .map((task) => {
        const occurrenceIso = nextRecurringOccurrenceInRange(
          task.dueAt,
          task.recurrenceType,
          task.recurrenceInterval,
          range.startIso,
          range.endIso,
          task.recurrenceEndAt,
        )
        return occurrenceIso
          ? {
              occurrenceDueAt: occurrenceDateTime(task.dueAt, occurrenceIso),
              occurrenceIso,
              task,
            }
          : null
      })
      .filter((row): row is DashboardTask => Boolean(row))
      .sort((left, right) => {
        const leftMine = left.task.assignedTo === store.currentUserId ? 0 : 1
        const rightMine = right.task.assignedTo === store.currentUserId ? 0 : 1
        if (leftMine !== rightMine) return leftMine - rightMine
        const priorityDifference = priorityWeight[left.task.priority] - priorityWeight[right.task.priority]
        if (priorityDifference !== 0) return priorityDifference
        return left.occurrenceDueAt.localeCompare(right.occurrenceDueAt)
      })
  }, [range.endIso, range.startIso, state.tasks, store.currentUserId])

  const mealsInScope = useMemo<DashboardMeal[]>(() => {
    return state.meals
      .map((meal) => {
        const displayDate = mealDisplayDate(meal)
        return {
          audience: meal.assignedTo ? state.members.find((person) => person.id === meal.assignedTo) : undefined,
          displayDate,
          isPersonalized: Boolean(meal.assignedTo),
          meal,
        }
      })
      .filter((row) => isIsoDateInRange(row.displayDate, range.startIso, range.endIso) || isIsoDateInRange(row.meal.planDate, range.startIso, range.endIso))
      .sort((left, right) => {
        const leftMine = left.meal.assignedTo === store.currentUserId ? 0 : 1
        const rightMine = right.meal.assignedTo === store.currentUserId ? 0 : 1
        if (leftMine !== rightMine) return leftMine - rightMine
        const dateDifference = left.displayDate.localeCompare(right.displayDate)
        if (dateDifference !== 0) return dateDifference
        return mealTypeWeight[left.meal.mealType] - mealTypeWeight[right.meal.mealType]
      })
  }, [range.endIso, range.startIso, state.meals, state.members, store.currentUserId])

  const mealGroups = useMemo<DashboardMealGroup[]>(() => {
    const groups = new Map<string, DashboardMealGroup>()

    mealsInScope.forEach((row) => {
      const key = `${row.displayDate}:${row.meal.mealType}`
      const existing = groups.get(key) ?? {
        date: row.displayDate,
        key,
        mealType: row.meal.mealType,
        meals: [],
        personalMeals: [],
      }
      existing.meals.push(row)
      if (row.isPersonalized) {
        existing.personalMeals.push(row)
      } else if (!existing.familyMeal) {
        existing.familyMeal = row
      }
      groups.set(key, existing)
    })

    return Array.from(groups.values()).sort((left, right) => {
      const dateDifference = left.date.localeCompare(right.date)
      if (dateDifference !== 0) return dateDifference
      return mealTypeWeight[left.mealType] - mealTypeWeight[right.mealType]
    })
  }, [mealsInScope])

  const mealKpis = useMemo(() => {
    const familySlots = mealGroups.filter((group) => group.familyMeal).length
    const personalChanges = mealGroups.reduce((count, group) => count + group.personalMeals.length, 0)
    const coveredMemberIds = new Set(mealGroups.flatMap((group) => group.personalMeals.map((row) => row.meal.assignedTo)).filter(Boolean))
    return {
      coveredMembers: coveredMemberIds.size,
      familySlots,
      personalChanges,
      totalSlots: mealGroups.length,
    }
  }, [mealGroups])

  const visibleMealGroups = useMemo(() => {
    if (scope !== 'today') {
      return mealGroups
    }

    return mealSlotOrder.map((mealType) => {
      const existing = mealGroups.find((group) => group.date === range.startIso && group.mealType === mealType)
      return existing ?? {
        date: range.startIso,
        key: `missing-${range.startIso}:${mealType}`,
        mealType,
        meals: [],
        personalMeals: [],
      }
    })
  }, [mealGroups, range.startIso, scope])

  const groceryRows = useMemo<GroceryDashboardRow[]>(() => {
    const shoppingRows = state.shoppingItems
      .map<ShoppingDashboardRow>((item) => {
        const cycle = cycleById.get(item.cycleId)
        return {
          cycle,
          grocery: groceryById.get(item.itemId),
          item,
          key: `shopping-${item.id}`,
          listType: listTypeById.get(item.listTypeId),
          source: 'shopping',
        }
      })
      .filter((row) => !row.item.isPurchased)
      .filter((row) => {
        if (!row.cycle) return true
        return isoDateRangesOverlap(row.cycle.cycleStartDate, row.cycle.cycleEndDate, range.startIso, range.endIso)
      })
      .sort((left, right) => {
        const placeDifference = (left.listType?.listName ?? '').localeCompare(right.listType?.listName ?? '')
        if (placeDifference !== 0) return placeDifference
        return left.item.itemName.localeCompare(right.item.itemName)
      })

    const shoppingItemIds = new Set(shoppingRows.map((row) => row.item.itemId))
    const masterRows = state.groceryItems
      .filter((item) => item.needsPurchase || !item.currentStock)
      .filter((item) => !shoppingItemIds.has(item.id))
      .filter((item) => item.startDate <= range.endIso)
      .map<MasterGroceryDashboardRow>((item) => ({
        item,
        key: `master-${item.id}`,
        listType: listTypeById.get(item.listTypeId),
        source: 'master',
      }))
      .sort((left, right) => (left.listType?.listName ?? '').localeCompare(right.listType?.listName ?? '') || left.item.itemName.localeCompare(right.item.itemName))

    return [...shoppingRows, ...masterRows].sort((left, right) => {
      const placeDifference = (left.listType?.listName ?? '').localeCompare(right.listType?.listName ?? '')
      if (placeDifference !== 0) return placeDifference
      return left.item.itemName.localeCompare(right.item.itemName)
    })
  }, [cycleById, groceryById, listTypeById, range.endIso, range.startIso, state.groceryItems, state.shoppingItems])

  const attentionQueue = useMemo<DashboardNotice[]>(() => {
    const items: DashboardNotice[] = []

    tasksInScope.forEach((row) => {
      items.push({
        body: `${state.members.find((member) => member.id === row.task.assignedTo)?.name ?? 'Unassigned'} - ${formatDueLabel(row.occurrenceDueAt, state.family.timezone)}`,
        category: 'Deadline',
        icon: Clock3,
        key: `task-${row.task.id}`,
        onClick: () => setSelected({ kind: 'task', id: row.task.id }),
        title: row.task.title,
        tone: row.task.priority === 'high' ? 'rose' : 'indigo',
      })
    })

    state.notifications.filter((notification) => !notification.isRead).forEach((notification) => {
      items.push({
        body: notification.message,
        category: 'Unread',
        icon: Bell,
        key: `notification-${notification.id}`,
        title: notification.title,
        tone: notification.type === 'grocery' ? 'green' : notification.type === 'meal' ? 'amber' : 'rose',
      })
    })

    groceryRows.forEach((row) => {
      items.push({
        body: `${row.listType?.listName ?? 'Shopping list'} - ${row.item.quantity} ${row.item.unit}`,
        category: 'Shopping',
        icon: ShoppingBasket,
        key: `grocery-${row.key}`,
        onClick: () => setSelected({ kind: 'grocery', key: row.key }),
        title: `Buy ${row.item.itemName}`,
        tone: 'green',
      })
    })

    mealGroups.filter((group) => group.personalMeals.length > 0).forEach((group) => {
      items.push({
        body: `${group.personalMeals.length} personal meal change${group.personalMeals.length === 1 ? '' : 's'} for ${formatCompactDate(group.date)}`,
        category: 'Meal change',
        icon: ChefHat,
        key: `meal-${group.key}`,
        onClick: () => setSelected({ kind: 'meal', key: group.key }),
        title: `${mealSlotLabel[group.mealType]} variation`,
        tone: 'amber',
      })
    })

    return items
  }, [groceryRows, mealGroups, state.family.timezone, state.members, state.notifications, tasksInScope])

  const attentionGroups = useMemo<AttentionGroup[]>(() => {
    const unreadCount = state.notifications.filter((notification) => !notification.isRead).length
    const firstUnread = state.notifications.find((notification) => !notification.isRead)
    const firstTask = tasksInScope[0]
    const firstGrocery = groceryRows[0]
    const firstMealChange = mealGroups.find((group) => group.personalMeals.length > 0)

    return [
      {
        body: firstTask
          ? `${firstTask.task.title} - ${formatDueLabel(firstTask.occurrenceDueAt, state.family.timezone)}`
          : 'No scoped deadlines',
        count: tasksInScope.length,
        icon: Clock3,
        key: 'deadlines',
        label: 'Deadlines',
        tone: 'indigo',
      },
      {
        body: firstUnread ? firstUnread.title : 'No unread alerts',
        count: unreadCount,
        icon: Bell,
        key: 'unread',
        label: 'Unread alerts',
        tone: unreadCount > 0 ? 'rose' : 'indigo',
      },
      {
        body: firstGrocery ? `${firstGrocery.item.itemName} - ${firstGrocery.listType?.listName ?? 'Shopping list'}` : 'No shopping pressure',
        count: groceryRows.length,
        icon: ShoppingBasket,
        key: 'shopping',
        label: 'Shopping',
        tone: 'green',
      },
      {
        body: firstMealChange ? `${mealSlotLabel[firstMealChange.mealType]} has ${firstMealChange.personalMeals.length} change${firstMealChange.personalMeals.length === 1 ? '' : 's'}` : 'No personal meal changes',
        count: mealKpis.personalChanges,
        icon: ChefHat,
        key: 'meal-changes',
        label: 'Meal changes',
        tone: 'amber',
      },
    ]
  }, [groceryRows, mealGroups, mealKpis.personalChanges, state.family.timezone, state.notifications, tasksInScope])

  const selectedTask = selected?.kind === 'task' ? state.tasks.find((task) => task.id === selected.id) : undefined
  const selectedTaskOccurrenceIso = selectedTask
    ? nextRecurringOccurrenceInRange(
        selectedTask.dueAt,
        selectedTask.recurrenceType,
        selectedTask.recurrenceInterval,
        range.startIso,
        range.endIso,
        selectedTask.recurrenceEndAt,
      )
    : null
  const selectedTaskDueAt = selectedTask && selectedTaskOccurrenceIso ? occurrenceDateTime(selectedTask.dueAt, selectedTaskOccurrenceIso) : selectedTask?.dueAt
  const selectedMealGroup = selected?.kind === 'meal' ? mealGroups.find((group) => group.key === selected.key) : undefined
  const selectedGrocery = selected?.kind === 'grocery' ? groceryRows.find((row) => row.key === selected.key) : undefined

  const openOnKeyboard = (event: ReactKeyboardEvent<HTMLElement>, detail: DetailSelection) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelected(detail)
    }
  }

  const scopeDescription =
    scope === 'today'
      ? formatFullDate(range.startIso)
      : `${formatCompactDate(range.startIso)} to ${formatCompactDate(range.endIso)}`

  return (
    <div className="grid gap-6">
      <section className="accent-panel relative overflow-hidden rounded-2xl px-5 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_70%_-10%,rgb(255_255_255/0.12),transparent)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge icon={<Users className="size-3.5" aria-hidden="true" />} mode="pill" className="border-white/30 bg-white/90 text-indigo-700 shadow-sm">
                {currentMember ? `${currentMember.name}'s family view` : 'Family view'}
              </Badge>
              <Badge mode="pill" className="border-white/30 bg-white/90 text-indigo-700 shadow-sm">{scopeDescription}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Home Dashboard</h2>
            <p className="mt-1 text-sm text-white/75">
              Tasks, meals, and groceries scheduled for {scopeLabel(scope)}.
            </p>
          </div>

          <div className="flex rounded-xl border border-white/20 bg-white/10 p-1 shadow-sm backdrop-blur-sm">
            {scopeOptions.map((option) => (
              <button
                className={cn(
                  'min-h-10 rounded-lg px-4 text-sm font-bold transition',
                  scope === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
                key={option.value}
                onClick={() => setScope(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_24px_rgb(15_23_42/0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950">Attention Queue</h3>
            <p className="mt-0.5 text-xs text-slate-400">Grouped signals by urgency and type. Open the queue for the full list.</p>
          </div>
          <Button className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setAttentionOpen(true)} variant="secondary">
            <Bell className="size-3.5" aria-hidden="true" />
            Open queue ({attentionQueue.length})
          </Button>
        </div>
        {attentionQueue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-400">
            No attention items for {scopeLabel(scope)}.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {attentionGroups.map((group) => {
              const Icon = group.icon
              const iconGradient: Record<NoticeTone, string> = {
                indigo: 'from-indigo-500 to-blue-600 shadow-indigo-500/25',
                rose: 'from-rose-500 to-pink-600 shadow-rose-500/25',
                green: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
                amber: 'from-amber-500 to-orange-600 shadow-amber-500/25',
              }
              const accentRgb: Record<NoticeTone, string> = {
                indigo: '99 102 241',
                rose: '244 63 94',
                green: '16 185 129',
                amber: '245 158 11',
              }

              return (
                <button
                  className="kpi-card min-h-28 p-4 text-left"
                  key={group.key}
                  onClick={() => setAttentionOpen(true)}
                  style={{ '--kpi-accent': accentRgb[group.tone], '--kpi-glow': `rgb(${accentRgb[group.tone]} / 0.06)`, '--kpi-shadow': `rgb(${accentRgb[group.tone]} / 0.10)` } as React.CSSProperties}
                  type="button"
                >
                  <div className="kpi-shimmer" />
                  <div className="kpi-glow-line" />
                  <div className="relative flex items-start gap-3">
                    <span className={cn('kpi-icon grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-lg', iconGradient[group.tone])}>
                      <Icon className="size-4.5 text-white" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="kpi-value block text-2xl font-extrabold leading-none text-slate-900">{group.count}</span>
                      <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</span>
                      <span className="mt-1.5 line-clamp-2 block text-[11px] leading-4 text-slate-500">{group.body}</span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-indigo-600" aria-hidden="true" />
                Tasks
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">{tasksInScope.length} active reminder{tasksInScope.length === 1 ? '' : 's'}</p>
            </div>
            <Badge tone="indigo">{tasksInScope.filter((row) => row.task.assignedTo === store.currentUserId).length} mine</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {tasksInScope.length === 0 ? (
              <SectionEmpty>{emptyMessage('Tasks', scope)}</SectionEmpty>
            ) : (
              tasksInScope.map(({ occurrenceDueAt, task }) => {
                const member = state.members.find((person) => person.id === task.assignedTo)

                return (
                  <article
                    className="group grid cursor-pointer gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md"
                    key={task.id}
                    onClick={() => setSelected({ kind: 'task', id: task.id })}
                    onKeyDown={(event) => openOnKeyboard(event, { kind: 'task', id: task.id })}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {member ? (
                          <Avatar className="size-10 shrink-0" colorClass={member.colorClass} initial={member.initial} label={member.name} />
                        ) : (
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
                            <UserRound className="size-4" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{member?.name ?? 'Unassigned'} - {formatDueLabel(occurrenceDueAt, state.family.timezone)}</p>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={task.priority === 'high' ? 'rose' : task.priority === 'medium' ? 'amber' : 'green'}>{task.priority}</Badge>
                        <Badge tone="slate">{task.category}</Badge>
                        {task.recurrenceType !== 'none' && <Badge tone="violet">{task.recurrenceType}</Badge>}
                      </div>
                      <button
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                        disabled={!canManageTasks}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleTaskStatus(task.id)
                        }}
                        type="button"
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Done
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="size-4 text-amber-600" aria-hidden="true" />
                Meals
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">{mealGroups.length} meal slot{mealGroups.length === 1 ? '' : 's'} in scope</p>
            </div>
            <Badge tone="amber">{scope === 'today' ? 'Daily plan' : 'Weekly plan'}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="kpi-card px-4 py-3.5" style={{ '--kpi-accent': '245 158 11', '--kpi-glow': 'rgb(245 158 11 / 0.06)', '--kpi-shadow': 'rgb(245 158 11 / 0.08)' } as React.CSSProperties}>
                <div className="kpi-shimmer" />
                <div className="kpi-glow-line" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Family slots</p>
                  <p className="kpi-value mt-1 text-2xl font-extrabold text-slate-900">{mealKpis.familySlots}</p>
                </div>
              </div>
              <div className="kpi-card px-4 py-3.5" style={{ '--kpi-accent': '99 102 241', '--kpi-glow': 'rgb(99 102 241 / 0.06)', '--kpi-shadow': 'rgb(99 102 241 / 0.08)' } as React.CSSProperties}>
                <div className="kpi-shimmer" />
                <div className="kpi-glow-line" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Personal changes</p>
                  <p className="kpi-value mt-1 text-2xl font-extrabold text-slate-900">{mealKpis.personalChanges}</p>
                </div>
              </div>
              <div className="kpi-card px-4 py-3.5" style={{ '--kpi-accent': '16 185 129', '--kpi-glow': 'rgb(16 185 129 / 0.06)', '--kpi-shadow': 'rgb(16 185 129 / 0.08)' } as React.CSSProperties}>
                <div className="kpi-shimmer" />
                <div className="kpi-glow-line" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Members covered</p>
                  <p className="kpi-value mt-1 text-2xl font-extrabold text-slate-900">{mealKpis.coveredMembers || state.members.length}</p>
                </div>
              </div>
            </div>

            {visibleMealGroups.length === 0 ? (
              <SectionEmpty>{emptyMessage('Meals', scope)}</SectionEmpty>
            ) : (
              <div className="grid max-h-[34rem] gap-3 overflow-auto pr-1">
                {visibleMealGroups.map((group) => {
                  const primaryMeal = group.familyMeal ?? group.meals[0]
                  const hasPlan = group.meals.length > 0

                  return (
                    <article
                      className={cn(
                        'group grid gap-3 rounded-xl border p-4 shadow-sm transition',
                        hasPlan
                          ? 'cursor-pointer border-slate-100 bg-white hover:border-amber-200 hover:bg-amber-50/30 hover:shadow-md'
                          : 'border-dashed border-slate-200 bg-slate-50/70',
                      )}
                      key={group.key}
                      onClick={() => { if (hasPlan) setSelected({ kind: 'meal', key: group.key }) }}
                      onKeyDown={(event) => { if (hasPlan) openOnKeyboard(event, { kind: 'meal', key: group.key }) }}
                      role={hasPlan ? 'button' : undefined}
                      tabIndex={hasPlan ? 0 : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{mealSlotLabel[group.mealType]}</p>
                            <Badge tone="slate">{formatCompactDate(group.date)}</Badge>
                          </div>
                          <div className={cn('mt-2 line-clamp-2 text-sm font-semibold', hasPlan ? 'text-slate-900' : 'text-slate-400')}>
                            {primaryMeal ? (
                              <StructuredText value={primaryMeal.meal.mealName} />
                            ) : (
                              'No plan for this slot'
                            )}
                          </div>
                          {primaryMeal?.meal.description && (
                            <StructuredText className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500" value={primaryMeal.meal.description} />
                          )}
                        </div>
                        {hasPlan && <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:text-amber-500" aria-hidden="true" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {primaryMeal ? (
                          <>
                            <Badge tone="amber">{primaryMeal.meal.prepTime}m prep</Badge>
                            <Badge tone="green">{primaryMeal.meal.calories} cal</Badge>
                            <Badge tone={group.familyMeal ? 'slate' : 'indigo'}>{group.familyMeal ? 'Family' : primaryMeal.audience?.name ?? 'Member'}</Badge>
                          </>
                        ) : (
                          <Badge tone="rose">Gap</Badge>
                        )}
                        {group.personalMeals.length > 0 && <Badge tone="indigo">{group.personalMeals.length} personal</Badge>}
                        {group.personalMeals.slice(0, 4).map((row) => row.audience ? (
                          <Avatar className="size-6 text-[10px]" colorClass={row.audience.colorClass} initial={row.audience.initial} key={row.meal.id} label={row.audience.name} />
                        ) : null)}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBasket className="size-4 text-emerald-600" aria-hidden="true" />
                Groceries
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">{groceryRows.length} item{groceryRows.length === 1 ? '' : 's'} to buy</p>
            </div>
            <Badge tone="green">Open only</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {groceryRows.length === 0 ? (
              <SectionEmpty>{emptyMessage('Groceries', scope)}</SectionEmpty>
            ) : (
              groceryRows.map((row) => {
                const itemName = row.item.itemName
                const quantity = `${row.item.quantity} ${row.item.unit}`
                const placeName = row.listType?.listName ?? 'Shopping list'

                return (
                  <article
                    className="group grid cursor-pointer gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-md"
                    key={row.key}
                    onClick={() => setSelected({ kind: 'grocery', key: row.key })}
                    onKeyDown={(event) => openOnKeyboard(event, { kind: 'grocery', key: row.key })}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{itemName}</p>
                        <p className="mt-1 text-xs text-slate-500">{placeName} - {quantity}</p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="green">{row.source === 'shopping' ? row.item.frequency : row.item.purchaseFrequency}</Badge>
                        {row.source === 'shopping' && row.item.carriedForward && <Badge tone="amber">Carry</Badge>}
                      </div>
                      <button
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                        disabled={!canManageGroceries}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (row.source === 'shopping') {
                            updateShoppingItem(row.item.id, { isPurchased: true })
                          } else {
                            toggleGroceryPurchased(row.item.id)
                          }
                        }}
                        type="button"
                      >
                        <PackageCheck className="size-3.5" aria-hidden="true" />
                        Bought
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-[0_10px_40px_rgb(15_23_42/0.18)] sm:grid-cols-3">
        <button
          className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left text-white transition hover:bg-white/[0.12]"
          disabled={!store.can('view_tasks')}
          onClick={() => onNavigate('tasks', { scope })}
          type="button"
        >
          <span>
            <span className="block text-sm font-bold">Tasks</span>
            <span className="mt-1 block text-xs text-white/60">Open {scopeLabel(scope)} task board</span>
          </span>
          <CalendarClock className="size-5 text-indigo-300 transition group-hover:scale-110" aria-hidden="true" />
        </button>
        <button
          className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left text-white transition hover:bg-white/[0.12]"
          disabled={!store.can('view_groceries')}
          onClick={() => onNavigate('groceries', { scope })}
          type="button"
        >
          <span>
            <span className="block text-sm font-bold">Shop Now</span>
            <span className="mt-1 block text-xs text-white/60">Open {scopeLabel(scope)} shopping list</span>
          </span>
          <ShoppingCart className="size-5 text-emerald-300 transition group-hover:scale-110" aria-hidden="true" />
        </button>
        <button
          className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left text-white transition hover:bg-white/[0.12]"
          disabled={!store.can('view_meals')}
          onClick={() => onNavigate('meals', { scope })}
          type="button"
        >
          <span>
            <span className="block text-sm font-bold">Plan Meals</span>
            <span className="mt-1 block text-xs text-white/60">Open {scopeLabel(scope)} meal plan</span>
          </span>
          <CalendarCheck2 className="size-5 text-amber-300 transition group-hover:scale-110" aria-hidden="true" />
        </button>
      </section>

      {attentionOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" onClick={() => setAttentionOpen(false)}>
          <section
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Attention queue</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{attentionQueue.length} scoped item{attentionQueue.length === 1 ? '' : 's'}</h3>
              </div>
              <button
                className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setAttentionOpen(false)}
                title="Close queue"
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-auto px-6 py-5">
              <div className="grid gap-5">
                {['Deadline', 'Unread', 'Shopping', 'Meal change'].map((category) => {
                  const rows = attentionQueue.filter((item) => item.category === category)
                  if (rows.length === 0) return null

                  return (
                    <section className="grid gap-2" key={category}>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-slate-950">{category}</h4>
                        <Badge tone="slate">{rows.length}</Badge>
                      </div>
                      <div className="grid gap-2">
                        {rows.map((item) => {
                          const Icon = item.icon

                          return (
                            <button
                              className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-left transition hover:border-indigo-200 hover:bg-white hover:shadow-sm"
                              disabled={!item.onClick}
                              key={item.key}
                              onClick={() => {
                                setAttentionOpen(false)
                                item.onClick?.()
                              }}
                              type="button"
                            >
                              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl border', noticeToneClass[item.tone])}>
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-950">{item.title}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-500">{item.body}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {(selectedTask || selectedMealGroup || selectedGrocery) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <section
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  {selectedTask ? 'Task details' : selectedMealGroup ? 'Meal slot details' : 'Grocery details'}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">
                  {selectedTask?.title ??
                    (selectedMealGroup ? `${mealSlotLabel[selectedMealGroup.mealType]} - ${formatCompactDate(selectedMealGroup.date)}` : undefined) ??
                    selectedGrocery?.item.itemName}
                </h3>
              </div>
              <button
                className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setSelected(null)}
                title="Close details"
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-5">
              {selectedTask && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPair label="Assigned to" value={state.members.find((member) => member.id === selectedTask.assignedTo)?.name ?? 'Unassigned'} />
                    <InfoPair label="Due" value={formatDueLabel(selectedTaskDueAt ?? selectedTask.dueAt, state.family.timezone)} />
                    <InfoPair label="Priority" value={selectedTask.priority} />
                    <InfoPair label="Status" value={selectedTask.status.replace('_', ' ')} />
                    <InfoPair label="Category" value={selectedTask.category} />
                    <InfoPair label="Recurrence" value={selectedTask.recurrenceType} />
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Description</p>
                    <StructuredText className="mt-2 text-sm leading-6 text-slate-700" empty="No description added." value={selectedTask.description} />
                  </div>
                  {canManageTasks && (
                    <Button onClick={() => toggleTaskStatus(selectedTask.id)}>
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Mark task complete
                    </Button>
                  )}
                </>
              )}

              {selectedMealGroup && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPair label="Date" value={formatCompactDate(selectedMealGroup.date)} />
                    <InfoPair label="Slot" value={mealSlotLabel[selectedMealGroup.mealType]} />
                    <InfoPair label="Family plan" value={selectedMealGroup.familyMeal?.meal.mealName ?? 'No shared family meal'} />
                    <InfoPair label="Personal changes" value={selectedMealGroup.personalMeals.length} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-[11px] font-bold uppercase text-amber-600">Total plans</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{selectedMealGroup.meals.length}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-[11px] font-bold uppercase text-emerald-600">Calories</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {selectedMealGroup.meals.reduce((total, row) => total + row.meal.calories, 0)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                      <p className="text-[11px] font-bold uppercase text-indigo-600">Prep total</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {selectedMealGroup.meals.reduce((total, row) => total + row.meal.prepTime, 0)}m
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {selectedMealGroup.meals.map((row) => {
                      const rowRecipe = row.meal.recipeId ? state.recipes.find((recipe) => recipe.id === row.meal.recipeId) : undefined

                      return (
                        <article
                          className={cn(
                            'rounded-xl border p-4',
                            row.isPersonalized ? 'border-indigo-100 bg-indigo-50/50' : 'border-amber-100 bg-amber-50/40',
                          )}
                          key={row.meal.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              {row.audience ? (
                                <Avatar className="size-10 shrink-0" colorClass={row.audience.colorClass} initial={row.audience.initial} label={row.audience.name} />
                              ) : (
                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-amber-600">
                                  <Users className="size-4" aria-hidden="true" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <StructuredText className="text-sm font-bold text-slate-950" value={row.meal.mealName} />
                                <p className="mt-1 text-xs font-semibold text-slate-500">{row.audience?.name ?? 'Shared family plan'}</p>
                              </div>
                            </div>
                            <Badge tone={row.isPersonalized ? 'indigo' : 'amber'}>
                              {row.isPersonalized ? 'Personalized' : 'Family'}
                            </Badge>
                          </div>
                          <StructuredText className="mt-3 text-sm leading-6 text-slate-700" empty="No description added." value={row.meal.description} />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone="green">{row.meal.calories} cal</Badge>
                            <Badge tone="amber">{row.meal.prepTime}m prep</Badge>
                            <Badge tone="slate">{rowRecipe?.recipeName ?? 'No recipe'}</Badge>
                            {(row.meal.dietaryFlags ?? []).map((flag) => (
                              <Badge key={flag} tone="teal">{flag}</Badge>
                            ))}
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  {selectedMealGroup.meals.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-400">
                      No meal plan exists for this slot.
                    </div>
                  )}
                </>
              )}

              {selectedGrocery && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPair label="Shopping place" value={selectedGrocery.listType?.listName ?? 'Shopping list'} />
                    <InfoPair label="Quantity" value={`${selectedGrocery.item.quantity} ${selectedGrocery.item.unit}`} />
                    <InfoPair label="Frequency" value={selectedGrocery.source === 'shopping' ? selectedGrocery.item.frequency : selectedGrocery.item.purchaseFrequency} />
                    <InfoPair label="Item number" value={selectedGrocery.item.itemNumber} />
                    {selectedGrocery.source === 'shopping' && (
                      <>
                        <InfoPair label="Bought" value={`${selectedGrocery.item.purchasedQuantity} ${selectedGrocery.item.unit}`} />
                        <InfoPair
                          label="Cycle"
                          value={
                            selectedGrocery.cycle
                              ? `${formatCompactDate(selectedGrocery.cycle.cycleStartDate)} to ${formatCompactDate(selectedGrocery.cycle.cycleEndDate)}`
                              : 'Current cycle'
                          }
                        />
                      </>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Notes</p>
                    <StructuredText className="mt-2 text-sm leading-6 text-slate-700" empty="No notes added." value={selectedGrocery.item.notes} />
                  </div>
                  {canManageGroceries && (
                    <Button
                      onClick={() => {
                        if (selectedGrocery.source === 'shopping') {
                          updateShoppingItem(selectedGrocery.item.id, { isPurchased: true })
                        } else {
                          toggleGroceryPurchased(selectedGrocery.item.id)
                        }
                        setSelected(null)
                      }}
                    >
                      <PackageCheck className="size-4" aria-hidden="true" />
                      Mark bought
                    </Button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
