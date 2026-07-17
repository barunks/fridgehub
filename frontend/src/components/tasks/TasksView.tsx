import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  GripVertical,
  ListFilter,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { FamilyMember, NewTaskInput, Priority, RecurrenceType, Task, TaskStatus, TaskUpdateInput, TimeScope } from '@/types/familyHub'
import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  formatCompactDate,
  formatDueLabel,
  nextRecurringOccurrenceInRange,
  recurringDateIntersectsRange,
  todayIso,
  weekEndIso,
  weekStartIso,
} from '@/utils/date'
import { cn } from '@/utils/style'

const priorityTone: Record<Priority, 'green' | 'amber' | 'rose'> = {
  low: 'green',
  medium: 'amber',
  high: 'rose',
}

const statusLabel: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const recurrenceOptions: Array<{ label: string; unit: string; value: RecurrenceType }> = [
  { value: 'none', label: 'No repeat', unit: 'time' },
  { value: 'daily', label: 'Daily', unit: 'day' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'monthly', label: 'Monthly', unit: 'month' },
  { value: 'quarterly', label: 'Quarterly', unit: 'quarter' },
  { value: 'semi_annually', label: 'Semi-annually', unit: 'half-year' },
  { value: 'yearly', label: 'Yearly', unit: 'year' },
]

const reminderLeadOptions = [
  { label: 'At due time', minutes: 0 },
  { label: '15 min before', minutes: 15 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1_440 },
]

const priorityWeight: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const chipClass = (active: boolean) =>
  cn(
    'soft-pill min-h-10 px-3.5 text-sm font-semibold transition-all',
    active
      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
      : 'border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300 hover:text-slate-700',
  )

type ScheduledTask = Task & {
  anchorDueAt?: string
}

type TaskEditDraft = NewTaskInput & {
  status: TaskStatus
}

const scopeFromSearchParam = (value: string | null): TimeScope | null =>
  value === 'today' || value === 'week' ? value : null

const dateScopesFromSearchParam = (value: string | null): TimeScope[] => {
  if (!value || value === 'all') return []
  const scopes = value
    .split(',')
    .map((item) => scopeFromSearchParam(item))
    .filter((item): item is TimeScope => Boolean(item))
  return Array.from(new Set(scopes))
}

const statusesFromSearchParam = (value: string | null): TaskStatus[] => {
  if (!value || value === 'all') return []
  const values = new Set(Object.keys(statusLabel))
  return Array.from(new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is TaskStatus => values.has(item)),
  ))
}

const textListFromSearchParam = (value: string | null) =>
  value && value !== 'all'
    ? Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)))
    : []

const numberListFromSearchParam = (value: string | null) =>
  textListFromSearchParam(value)
    .map((item) => Number(item))
    .filter((item, index, items) => Number.isFinite(item) && items.indexOf(item) === index)

const selectionsEqual = <T,>(left: T[], right: T[]) =>
  left.length === right.length && left.every((item) => right.includes(item))

const toggleSelection = <T,>(current: T[], value: T) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value]

type DateRange = {
  endIso: string
  startIso: string
}

const occurrenceInDateRanges = (task: Task, ranges: DateRange[]) =>
  ranges
    .map((range) =>
      nextRecurringOccurrenceInRange(
        task.dueAt,
        task.recurrenceType,
        task.recurrenceInterval,
        range.startIso,
        range.endIso,
        task.recurrenceEndAt,
      ),
    )
    .filter((item): item is string => Boolean(item))
    .sort()[0] ?? null

const taskMatchesDateRanges = (task: Task, ranges: DateRange[]) =>
  ranges.length === 0 ||
  ranges.some((range) =>
    recurringDateIntersectsRange(
      task.dueAt,
      task.recurrenceType,
      task.recurrenceInterval,
      range.startIso,
      range.endIso,
      task.recurrenceEndAt,
    ),
  )

const occurrenceDateTime = (dateTime: string, occurrenceIso: string) => `${occurrenceIso}${dateTime.slice(10)}`

const occurrenceReminderDateTime = (task: Task, occurrenceIso: string) => {
  const dueAt = new Date(task.dueAt).getTime()
  const reminderAt = new Date(task.reminderAt || task.dueAt).getTime()
  const occurrenceDueAt = new Date(occurrenceDateTime(task.dueAt, occurrenceIso)).getTime()
  return new Date(occurrenceDueAt - (dueAt - reminderAt)).toISOString()
}

const toDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const defaultDueLocalValue = () => {
  const dueAt = new Date()
  dueAt.setHours(18, 0, 0, 0)
  return toDateTimeLocalValue(dueAt)
}

const taskToEditDraft = (task: ScheduledTask): TaskEditDraft => ({
  title: task.title,
  description: task.description,
  category: task.category,
  priority: task.priority,
  dueAt: toDateTimeLocalValue(new Date(task.anchorDueAt ?? task.dueAt)),
  reminderAt: task.reminderAt ? toDateTimeLocalValue(new Date(task.reminderAt)) : '',
  assignedTo: task.assignedTo,
  recurrenceType: task.recurrenceType,
  recurrenceInterval: task.recurrenceInterval,
  recurrenceEndAt: task.recurrenceEndAt ? toDateTimeLocalValue(new Date(task.recurrenceEndAt)) : '',
  status: task.status,
})

const repeatLabel = (task: Pick<Task, 'recurrenceEndAt' | 'recurrenceInterval' | 'recurrenceType'>) => {
  if (task.recurrenceType === 'none') return 'One-time'
  const option = recurrenceOptions.find((item) => item.value === task.recurrenceType)
  const interval = Math.max(1, Number(task.recurrenceInterval) || 1)
  const base = interval === 1 ? option?.label ?? task.recurrenceType : `Every ${interval} ${option?.unit ?? 'period'}${interval === 1 ? '' : 's'}`
  return task.recurrenceEndAt ? `${base} until ${formatCompactDate(task.recurrenceEndAt.slice(0, 10))}` : base
}

const isActiveTask = (task: Task) => task.status !== 'completed' && task.status !== 'cancelled'

const countOpenOccurrencesBefore = (task: ScheduledTask, familyTodayIso: string) => {
  if (!isActiveTask(task)) return 0
  const anchorDueAt = task.anchorDueAt ?? task.dueAt
  const anchorIso = anchorDueAt.slice(0, 10)
  const stopIso = task.recurrenceEndAt && task.recurrenceEndAt.slice(0, 10) < familyTodayIso
    ? task.recurrenceEndAt.slice(0, 10)
    : addDaysToIsoDate(familyTodayIso, -1)

  if (stopIso < anchorIso) return 0
  if (task.recurrenceType === 'none') return anchorIso <= stopIso ? 1 : 0

  let count = 0
  let cursorIso = anchorIso
  for (let guard = 0; guard < 500; guard += 1) {
    const occurrenceIso = nextRecurringOccurrenceInRange(
      anchorDueAt,
      task.recurrenceType,
      task.recurrenceInterval,
      cursorIso,
      stopIso,
      task.recurrenceEndAt,
    )
    if (!occurrenceIso) break
    count += 1
    cursorIso = addDaysToIsoDate(occurrenceIso, 1)
  }
  return count
}

const reminderStateLabel = (task: Task, familyTodayIso: string, familyTimezone?: string) => {
  if (!task.reminderAt) return 'No alert'
  const reminderIso = task.reminderAt.slice(0, 10)
  if (reminderIso < familyTodayIso) return 'Alert elapsed'
  if (reminderIso === familyTodayIso) return `Alert today ${formatDueLabel(task.reminderAt, familyTimezone).replace(/^Today at /, '')}`
  return `Alert ${formatDueLabel(task.reminderAt, familyTimezone)}`
}

interface TaskCardProps {
  canManageTasks: boolean
  deleteTask: (taskId: number) => void
  familyTodayIso: string
  familyTimezone?: string
  member?: FamilyMember
  members: FamilyMember[]
  openTask: (task: ScheduledTask) => void
  reassignTask: (taskId: number, memberId: number) => void
  task: ScheduledTask
  toggleTaskStatus: (taskId: number) => void
}

const priorityAccent: Record<Priority, { border: string; ring: string; icon: string; glow: string }> = {
  high: { border: 'border-rose-200/80', ring: 'ring-rose-100', icon: 'text-rose-500', glow: 'shadow-rose-500/8' },
  medium: { border: 'border-amber-200/80', ring: 'ring-amber-100', icon: 'text-amber-500', glow: 'shadow-amber-500/8' },
  low: { border: 'border-emerald-200/80', ring: 'ring-emerald-100', icon: 'text-emerald-500', glow: 'shadow-emerald-500/8' },
}

const TaskCard = ({
  canManageTasks,
  deleteTask,
  familyTodayIso,
  familyTimezone,
  member,
  members,
  openTask,
  reassignTask,
  task,
  toggleTaskStatus,
}: TaskCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
    disabled: !canManageTasks,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const isCompleted = task.status === 'completed'
  const accent = priorityAccent[task.priority]
  const missedOccurrences = countOpenOccurrencesBefore(task, familyTodayIso)
  const daysOpen = isActiveTask(task) ? Math.max(0, daysBetweenIsoDates(task.dueAt.slice(0, 10), familyTodayIso)) : 0
  const isCarryForward = missedOccurrences > 0 || daysOpen > 0
  const isAlertDue = isActiveTask(task) && Boolean(task.reminderAt && task.reminderAt.slice(0, 10) <= familyTodayIso)

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 transition-all duration-300',
        isDragging
          ? 'opacity-40 ring-2 ring-indigo-400 shadow-xl border-indigo-200'
          : isCompleted
            ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 shadow-sm'
            : cn(accent.border, accent.glow, 'bg-white shadow-[0_4px_20px_rgb(15_23_42/0.04)] hover:shadow-[0_12px_40px_rgb(15_23_42/0.08)] hover:-translate-y-0.5'),
      )}
      data-testid={`task-card-${task.id}`}
      onClick={() => openTask(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openTask(task)
        }
      }}
      role="button"
      tabIndex={0}
      ref={setNodeRef}
      style={style}
    >
      {/* Priority accent strip */}
      <div className={cn(
        'absolute left-0 top-0 h-full w-1 rounded-l-2xl',
        isCompleted ? 'bg-emerald-400' : task.priority === 'high' ? 'bg-gradient-to-b from-rose-500 to-pink-400' : task.priority === 'medium' ? 'bg-gradient-to-b from-amber-400 to-orange-400' : 'bg-gradient-to-b from-emerald-400 to-teal-400',
      )} />

      {/* Delete button — top right */}
      {canManageTasks && (
        <button
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-white/80 text-slate-300 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-rose-50 hover:text-rose-500 hover:shadow-md group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation()
            if (window.confirm(`Delete "${task.title}"?`)) deleteTask(task.id)
          }}
          title="Delete task"
          type="button"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      )}

      <div className="relative p-5 pl-6">
        <div className="grid gap-3">
          {/* Top row: drag handle + avatar + title + priority badge */}
          <div className="flex items-start gap-3">
            <button
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-500"
              data-testid={`drag-task-${task.id}`}
              disabled={!canManageTasks}
              onClick={(event) => event.stopPropagation()}
              title={`Drag ${task.title}`}
              type="button"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" aria-hidden="true" />
              <span className="sr-only">Move {task.title}</span>
            </button>
            {member && <Avatar className="size-10 ring-2 ring-white shadow-sm" colorClass={member.colorClass} initial={member.initial} label={member.name} />}
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={cn('text-[15px] font-bold leading-tight', isCompleted ? 'text-slate-400 line-through' : 'text-slate-900')}>
                  {task.title}
                </h3>
                <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
              </div>
              {task.description && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{task.description}</p>}
            </div>
          </div>

          {/* Meta chips */}
          <div className="ml-10 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
              <Clock3 className="size-3 text-indigo-400" aria-hidden="true" />
              {formatDueLabel(task.dueAt, familyTimezone)}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                isAlertDue ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-sky-100 bg-sky-50 text-sky-700',
              )}
            >
              <AlertTriangle className="size-3" aria-hidden="true" />
              {reminderStateLabel(task, familyTodayIso, familyTimezone)}
            </span>
            {task.recurrenceType !== 'none' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-600">
                <RotateCcw className="size-3" aria-hidden="true" />
                {repeatLabel(task)}
              </span>
            )}
            {isCarryForward && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                <CalendarPlus className="size-3" aria-hidden="true" />
                {missedOccurrences > 0 ? `${missedOccurrences} open occurrence${missedOccurrences === 1 ? '' : 's'}` : `${daysOpen} day${daysOpen === 1 ? '' : 's'} open`}
              </span>
            )}
            <span className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-600">
              {task.category}
            </span>
          </div>

          {/* Bottom row: reassign + complete */}
          <div className="ml-10 flex flex-wrap items-center justify-between gap-3 pt-1">
            <select
              aria-label={`Reassign ${task.title}`}
              className="min-h-8 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-medium text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              disabled={!canManageTasks}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => reassignTask(task.id, Number(event.target.value))}
              value={task.assignedTo}
            >
              {members.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <button
              className={cn(
                'group/btn flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-95',
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200/70 hover:shadow-sm'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:from-indigo-500 hover:to-blue-500',
              )}
              onClick={(event) => {
                event.stopPropagation()
                toggleTaskStatus(task.id)
              }}
              disabled={!canManageTasks}
              type="button"
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Done
                </>
              ) : (
                <>
                  <Circle className="size-4 transition-transform duration-200 group-hover/btn:scale-110" aria-hidden="true" />
                  Complete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

interface TaskLaneProps extends TaskCardProps {
  member: FamilyMember
  tasks: ScheduledTask[]
}

const TaskLane = ({
  canManageTasks,
  deleteTask,
  familyTodayIso,
  familyTimezone,
  member,
  members,
  openTask,
  reassignTask,
  tasks,
  toggleTaskStatus,
}: Omit<TaskLaneProps, 'task'>) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `member-${member.id}`,
    data: { memberId: member.id },
  })
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <section
      className={cn(
        'grid gap-3 rounded-2xl border p-4 transition-all duration-300',
        isOver
          ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100 shadow-lg'
          : 'border-slate-100/80 bg-gradient-to-b from-slate-50/80 to-white/50',
      )}
      data-testid={`member-lane-${member.id}`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="size-10" colorClass={member.colorClass} initial={member.initial} label={member.name} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">{member.name}</h3>
            <p className="truncate text-[11px] text-slate-400">{member.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={completedCount === tasks.length && tasks.length > 0 ? 'green' : 'slate'}>
            {completedCount}/{tasks.length}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              progress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-blue-400',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {tasks.length > 0 ? (
        <div className="stagger-children grid gap-3">
          {tasks.map((task) => (
            <TaskCard
              canManageTasks={canManageTasks}
              deleteTask={deleteTask}
              familyTodayIso={familyTodayIso}
              familyTimezone={familyTimezone}
              key={task.id}
              member={member}
              members={members}
              openTask={openTask}
              reassignTask={reassignTask}
              task={task}
              toggleTaskStatus={toggleTaskStatus}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-24 place-items-center rounded-xl border-2 border-dashed border-slate-200/60 bg-white/40 px-3 text-center">
          <div>
            <p className="text-xs font-medium text-slate-400">No tasks assigned</p>
            <p className="mt-0.5 text-[10px] text-slate-300">Drop reminders here</p>
          </div>
        </div>
      )}
    </section>
  )
}

export const TasksView = ({ store }: { store: FamilyHubStore }) => {
  const { state, addTask, updateTask, reassignTask, toggleTaskStatus, deleteTask, loadTaskPage } = store
  const canManageTasks = store.can('manage_tasks')
  const page = store.pagination.tasks
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => textListFromSearchParam(searchParams.get('category')))
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>(() => numberListFromSearchParam(searchParams.get('assignee')))
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(() => statusesFromSearchParam(searchParams.get('status')))
  const [selectedDateScopes, setSelectedDateScopes] = useState<TimeScope[]>(() => dateScopesFromSearchParam(searchParams.get('scope')))
  const ownSearchWritesRef = useRef(new Set<string>())
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null)
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft | null>(null)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const [draft, setDraft] = useState<NewTaskInput>({
    title: '',
    description: '',
    category: 'chore',
    priority: 'medium',
    dueAt: defaultDueLocalValue(),
    reminderAt: '',
    assignedTo: state.members[0]?.id ?? 0,
    recurrenceType: 'none',
    recurrenceInterval: 1,
    recurrenceEndAt: '',
  })

  const taskPageStatus = selectedStatuses.length === 1 ? selectedStatuses[0] : 'all'

  useEffect(() => {
    loadTaskPage(0, taskPageStatus)
  }, [loadTaskPage, taskPageStatus])

  useEffect(() => {
    const searchKey = searchParams.toString()
    if (ownSearchWritesRef.current.delete(searchKey)) {
      return
    }

    const nextScopes = dateScopesFromSearchParam(searchParams.get('scope'))
    const nextStatuses = statusesFromSearchParam(searchParams.get('status'))
    const nextCategories = textListFromSearchParam(searchParams.get('category'))
    const nextAssignees = numberListFromSearchParam(searchParams.get('assignee'))
    setSelectedDateScopes((current) => (selectionsEqual(nextScopes, current) ? current : nextScopes))
    setSelectedStatuses((current) => (selectionsEqual(nextStatuses, current) ? current : nextStatuses))
    setSelectedCategories((current) => (selectionsEqual(nextCategories, current) ? current : nextCategories))
    setSelectedAssignees((current) => (selectionsEqual(nextAssignees, current) ? current : nextAssignees))
  }, [searchParams])

  useEffect(() => {
    if (selectedTask) {
      setTaskEditDraft(taskToEditDraft(selectedTask))
    } else {
      setTaskEditDraft(null)
    }
  }, [selectedTask])

  const writeArrayParam = (params: URLSearchParams, key: string, values: Array<number | string>) => {
    if (values.length === 0) {
      params.delete(key)
    } else {
      params.set(key, values.join(','))
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    writeArrayParam(params, 'scope', selectedDateScopes)
    writeArrayParam(params, 'status', selectedStatuses)
    writeArrayParam(params, 'category', selectedCategories)
    writeArrayParam(params, 'assignee', selectedAssignees)
    const nextSearch = params.toString()
    if (nextSearch !== searchParams.toString()) {
      ownSearchWritesRef.current.add(nextSearch)
      setSearchParams(params, { replace: true })
    }
  }, [searchParams, selectedAssignees, selectedCategories, selectedDateScopes, selectedStatuses, setSearchParams])

  const updateDateScopes = (nextScopes: TimeScope[]) => setSelectedDateScopes(nextScopes)

  const toggleDateScope = (value: TimeScope) => {
    setSelectedDateScopes((current) => toggleSelection(current, value))
  }

  const updateStatuses = (nextStatuses: TaskStatus[]) => setSelectedStatuses(nextStatuses)

  const toggleStatus = (value: TaskStatus) => {
    setSelectedStatuses((current) => toggleSelection(current, value))
  }

  const updateCategories = (nextCategories: string[]) => setSelectedCategories(nextCategories)

  const toggleCategory = (value: string) => {
    setSelectedCategories((current) => toggleSelection(current, value))
  }

  const updateAssignees = (nextAssignees: number[]) => setSelectedAssignees(nextAssignees)

  const toggleAssignee = (value: number) => {
    setSelectedAssignees((current) => toggleSelection(current, value))
  }

  const familyToday = useMemo(() => todayIso(state.family.timezone), [state.family.timezone])

  const dateScopeRanges = useMemo(
    () =>
      selectedDateScopes.map((scope) =>
        scope === 'week'
          ? {
              endIso: weekEndIso(familyToday),
              startIso: weekStartIso(familyToday),
            }
          : {
              endIso: familyToday,
              startIso: familyToday,
            },
      ),
    [familyToday, selectedDateScopes],
  )

  const categories = useMemo(() => Array.from(new Set(state.tasks.map((task) => task.category))), [state.tasks])

  const filteredTasks = useMemo(() => {
    return state.tasks
      .filter((task) => {
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(task.category)
        const matchesAssignee = selectedAssignees.length === 0 || selectedAssignees.includes(task.assignedTo)
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(task.status)
        const matchesDate = taskMatchesDateRanges(task, dateScopeRanges)
        return matchesCategory && matchesAssignee && matchesStatus && matchesDate
      })
      .map((task) => {
        if (dateScopeRanges.length === 0) return task
        const occurrenceIso = occurrenceInDateRanges(task, dateScopeRanges)
        return occurrenceIso
          ? {
              ...task,
              anchorDueAt: task.dueAt,
              dueAt: occurrenceDateTime(task.dueAt, occurrenceIso),
              reminderAt: occurrenceReminderDateTime(task, occurrenceIso),
            }
          : task
      })
  }, [dateScopeRanges, selectedAssignees, selectedCategories, selectedStatuses, state.tasks])

  useEffect(() => {
    if (state.members.length === 0) return
    const hasAssignedMember = state.members.some((member) => member.id === draft.assignedTo)
    if (!hasAssignedMember) {
      setDraft((current) => ({ ...current, assignedTo: state.members[0].id }))
    }
  }, [draft.assignedTo, state.members])

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All Statuses' },
      ...Object.entries(statusLabel).map(([value, label]) => ({ value: value as TaskStatus, label })),
    ],
    [],
  )

  const focusedTasks = useMemo(() => {
    return [...filteredTasks]
      .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
      .sort((a, b) => {
        const priorityDifference = priorityWeight[a.priority] - priorityWeight[b.priority]
        if (priorityDifference !== 0) return priorityDifference
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      })
      .slice(0, 5)
  }, [filteredTasks])

  const tasksByMember = useMemo(() => {
    return state.members.reduce<Record<number, ScheduledTask[]>>((accumulator, member) => {
      accumulator[member.id] = filteredTasks.filter((task) => task.assignedTo === member.id)
      return accumulator
    }, {})
  }, [filteredTasks, state.members])

  const activeTask = activeTaskId ? state.tasks.find((task) => task.id === activeTaskId) : undefined

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = Number(String(event.active.id).replace('task-', ''))
    setActiveTaskId(Number.isNaN(taskId) ? null : taskId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canManageTasks) {
      setActiveTaskId(null)
      return
    }
    const taskId = Number(String(event.active.id).replace('task-', ''))
    const memberId = event.over ? Number(String(event.over.id).replace('member-', '')) : Number.NaN
    const task = state.tasks.find((item) => item.id === taskId)

    if (task && !Number.isNaN(memberId) && task.assignedTo !== memberId) {
      reassignTask(taskId, memberId)
    }
    setActiveTaskId(null)
  }

  const applyReminderLead = (minutes: number) => {
    if (!draft.dueAt) return
    const reminderAt = new Date(draft.dueAt)
    reminderAt.setMinutes(reminderAt.getMinutes() - minutes)
    setDraft((current) => ({ ...current, reminderAt: toDateTimeLocalValue(reminderAt) }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.title.trim() || state.members.length === 0) return
    const recurrenceType = draft.recurrenceType ?? 'none'
    addTask({
      ...draft,
      title: draft.title.trim(),
      category: draft.category.trim() || 'general',
      description: draft.description?.trim(),
      dueAt: new Date(draft.dueAt).toISOString(),
      reminderAt: draft.reminderAt ? new Date(draft.reminderAt).toISOString() : null,
      recurrenceType,
      recurrenceInterval: recurrenceType === 'none' ? 1 : Math.max(1, Number(draft.recurrenceInterval) || 1),
      recurrenceEndAt: recurrenceType !== 'none' && draft.recurrenceEndAt ? new Date(draft.recurrenceEndAt).toISOString() : null,
    })
    setDraft((current) => ({ ...current, title: '', description: '' }))
  }

  const closeTaskDetails = () => {
    setSelectedTask(null)
    setTaskEditDraft(null)
  }

  const handleTaskEditSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTask || !taskEditDraft || !taskEditDraft.title.trim()) return
    const recurrenceType = taskEditDraft.recurrenceType ?? 'none'
    const payload: TaskUpdateInput = {
      title: taskEditDraft.title.trim(),
      description: taskEditDraft.description?.trim() || '',
      category: taskEditDraft.category.trim() || 'general',
      priority: taskEditDraft.priority,
      status: taskEditDraft.status,
      assignedTo: taskEditDraft.assignedTo,
      dueAt: new Date(taskEditDraft.dueAt).toISOString(),
      reminderAt: taskEditDraft.reminderAt ? new Date(taskEditDraft.reminderAt).toISOString() : null,
      recurrenceType,
      recurrenceInterval: recurrenceType === 'none' ? 1 : Math.max(1, Number(taskEditDraft.recurrenceInterval) || 1),
      recurrenceEndAt: recurrenceType !== 'none' && taskEditDraft.recurrenceEndAt
        ? new Date(taskEditDraft.recurrenceEndAt).toISOString()
        : null,
    }
    updateTask(selectedTask.id, payload)
    closeTaskDetails()
  }

  const totalActive = filteredTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length
  const totalCompleted = filteredTasks.filter((t) => t.status === 'completed').length
  const carryForwardCount = filteredTasks.filter((task) => countOpenOccurrencesBefore(task, familyToday) > 0).length
  const alertDueCount = filteredTasks.filter((task) => isActiveTask(task) && task.reminderAt && task.reminderAt.slice(0, 10) <= familyToday).length
  const recurringCount = filteredTasks.filter((task) => task.recurrenceType !== 'none').length
  const activeThreshold = Math.max(8, state.members.length * 3)
  const selectedRecurrence = recurrenceOptions.find((option) => option.value === (draft.recurrenceType ?? 'none')) ?? recurrenceOptions[0]
  const repeatUnitLabel = `${selectedRecurrence.unit}${Number(draft.recurrenceInterval || 1) === 1 ? '' : 's'}`
  const selectedTaskMember = selectedTask ? state.members.find((member) => member.id === selectedTask.assignedTo) : undefined
  const selectedTaskMissed = selectedTask ? countOpenOccurrencesBefore(selectedTask, familyToday) : 0

  return (
    <div className="grid gap-6">
      <div className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-5 py-4 shadow-[0_20px_60px_rgb(139_92_246/0.35)]" style={{ backgroundSize: '200% 200%', animation: 'gradientShift 6s ease infinite' }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_70%_-10%,rgb(255_255_255/0.12),transparent)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Tasks & Reminders</h2>
              <p className="mt-0.5 text-sm text-white/75">{formatCompactDate(familyToday)} family task queue</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/20 bg-white/15 text-white">{totalActive}/{activeThreshold} active</Badge>
            <Badge className="border-white/20 bg-white/15 text-white">{totalCompleted} completed</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card p-5" style={{ '--kpi-accent': '99 102 241', '--kpi-glow': 'rgb(99 102 241 / 0.06)', '--kpi-shadow': 'rgb(99 102 241 / 0.10)' } as React.CSSProperties}>
          <div className="kpi-shimmer" />
          <div className="kpi-glow-line" />
          <div className="relative flex items-center gap-4">
            <div className="kpi-icon flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/25">
              <ClipboardList className="size-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Active load</p>
              <p className="kpi-value mt-0.5 text-2xl font-extrabold text-slate-900">{filteredTasks.filter(isActiveTask).length}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Visible in this view</p>
            </div>
          </div>
        </div>
        <div className="kpi-card p-5" style={{ '--kpi-accent': '244 63 94', '--kpi-glow': 'rgb(244 63 94 / 0.06)', '--kpi-shadow': 'rgb(244 63 94 / 0.10)' } as React.CSSProperties}>
          <div className="kpi-shimmer" />
          <div className="kpi-glow-line" />
          <div className="relative flex items-center gap-4">
            <div className="kpi-icon flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/25">
              <CalendarPlus className="size-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Carry-forward</p>
              <p className="kpi-value mt-0.5 text-2xl font-extrabold text-slate-900">{carryForwardCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Open past occurrences</p>
            </div>
          </div>
        </div>
        <div className="kpi-card p-5" style={{ '--kpi-accent': '245 158 11', '--kpi-glow': 'rgb(245 158 11 / 0.06)', '--kpi-shadow': 'rgb(245 158 11 / 0.10)' } as React.CSSProperties}>
          <div className="kpi-shimmer" />
          <div className="kpi-glow-line" />
          <div className="relative flex items-center gap-4">
            <div className="kpi-icon flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
              <AlertTriangle className="size-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Alerts due</p>
              <p className="kpi-value mt-0.5 text-2xl font-extrabold text-slate-900">{alertDueCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Reminder times reached</p>
            </div>
          </div>
        </div>
        <div className="kpi-card p-5" style={{ '--kpi-accent': '139 92 246', '--kpi-glow': 'rgb(139 92 246 / 0.06)', '--kpi-shadow': 'rgb(139 92 246 / 0.10)' } as React.CSSProperties}>
          <div className="kpi-shimmer" />
          <div className="kpi-glow-line" />
          <div className="relative flex items-center gap-4">
            <div className="kpi-icon flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <RotateCcw className="size-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recurring</p>
              <p className="kpi-value mt-0.5 text-2xl font-extrabold text-slate-900">{recurringCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Repeating rules in view</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          {/* Filters */}
          <Card variant="subtle">
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <ListFilter className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Board filters</p>
                    <p className="text-xs text-slate-400">Narrow by status, category, or assignee</p>
                  </div>
                </div>
                <Badge icon={<Sparkles className="size-3.5" aria-hidden="true" />} mode="pill" tone="indigo">
                  {filteredTasks.length} results
                </Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Date</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'all' as const, label: 'All dates' },
                      { value: 'today' as const, label: 'Today' },
                      { value: 'week' as const, label: 'This week' },
                    ].map((option) => {
                      const isActive = option.value === 'all' ? selectedDateScopes.length === 0 : selectedDateScopes.includes(option.value)
                      return (
                        <button
                          aria-pressed={isActive}
                          className={chipClass(isActive)}
                          data-testid={`task-filter-date-${option.value}`}
                          key={option.value}
	                          onClick={() =>
	                            option.value === 'all'
	                              ? updateDateScopes([])
	                              : toggleDateScope(option.value)
	                          }
                          type="button"
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => {
                      const isActive = option.value === 'all' ? selectedStatuses.length === 0 : selectedStatuses.includes(option.value)
                      return (
                        <button
                          aria-pressed={isActive}
                          className={chipClass(isActive)}
                          data-testid={`task-filter-status-${option.value}`}
                          key={option.value}
	                          onClick={() =>
	                            option.value === 'all'
	                              ? updateStatuses([])
	                              : toggleStatus(option.value)
	                          }
                          type="button"
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Category</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-pressed={selectedCategories.length === 0}
                      className={chipClass(selectedCategories.length === 0)}
                      data-testid="task-filter-category-all"
                      onClick={() => updateCategories([])}
                      type="button"
                    >
                      All Catagories
                    </button>
                    {categories.map((item) => (
                      <button
                        aria-pressed={selectedCategories.includes(item)}
                        className={chipClass(selectedCategories.includes(item))}
                        data-testid={`task-filter-category-${item}`}
                        key={item}
                        onClick={() => toggleCategory(item)}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Assignee</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-pressed={selectedAssignees.length === 0}
                      className={chipClass(selectedAssignees.length === 0)}
                      data-testid="task-filter-assignee-all"
                      onClick={() => updateAssignees([])}
                      type="button"
                    >
                      <UserRound className="size-4" aria-hidden="true" />
                      Everyone
                    </button>
                    {state.members.map((member) => (
                      <button
                        aria-pressed={selectedAssignees.includes(member.id)}
                        className={chipClass(selectedAssignees.includes(member.id))}
                        data-testid={`task-filter-assignee-${member.id}`}
                        key={member.id}
                        onClick={() => toggleAssignee(member.id)}
                        type="button"
                      >
                        <Avatar className="size-5 text-[10px]" colorClass={member.colorClass} initial={member.initial} label={member.name} />
                        {member.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Board */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Assignment Board</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Drag reminders between members to reassign</p>
              </div>
              <Badge tone="indigo">{state.members.length} members</Badge>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
                <div className="grid gap-5 xl:grid-cols-2">
                  {state.members.map((member) => (
                    <TaskLane
                      canManageTasks={canManageTasks}
                      deleteTask={deleteTask}
                      familyTodayIso={familyToday}
                      familyTimezone={state.family.timezone}
                      key={member.id}
                      member={member}
                      members={state.members}
                      openTask={setSelectedTask}
                      reassignTask={reassignTask}
                      tasks={tasksByMember[member.id] ?? []}
                      toggleTaskStatus={toggleTaskStatus}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask ? (
                    <article className="w-[min(30rem,90vw)] rounded-2xl border border-indigo-200 bg-white/95 p-5 shadow-2xl backdrop-blur-sm">
                      <h3 className="font-semibold text-slate-900">{activeTask.title}</h3>
                      <p className="mt-1 text-xs text-slate-400">{activeTask.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={priorityTone[activeTask.priority]}>{activeTask.priority}</Badge>
                        <Badge tone={activeTask.status === 'completed' ? 'green' : 'indigo'}>
                          {statusLabel[activeTask.status]}
                        </Badge>
                      </div>
                    </article>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/80 pt-4">
                <p className="text-xs font-medium text-slate-400">
                  Page {Math.floor(page.offset / page.limit) + 1}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={page.offset === 0 || page.isLoading}
                    onClick={() => loadTaskPage(page.offset - page.limit, taskPageStatus)}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!page.hasNext || page.isLoading}
                    onClick={() => loadTaskPage(page.offset + page.limit, taskPageStatus)}
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="grid gap-5 self-start">
          {/* Add Reminder form */}
          <Card className="border-indigo-100/60">
            <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-blue-50/30">
              <CardTitle>Add Reminder</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Create a new task for the family</p>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3.5" onSubmit={handleSubmit}>
	                <fieldset className="m-0 grid gap-3.5 border-0 p-0" disabled={!canManageTasks || state.members.length === 0}>
                  <FormField label="Title">
                    <input
                      className={inputClass}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Water plants, pick up groceries..."
                      value={draft.title}
                    />
                  </FormField>
                  <FormField label="Note">
                    <textarea
                      className={cn(inputClass, 'min-h-20 resize-y leading-relaxed')}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Short instruction, carry-forward note, or alert context"
                      value={draft.description ?? ''}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Category">
                      <input
                        className={inputClass}
                        onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                        value={draft.category}
                      />
                    </FormField>
                    <FormField label="Priority">
	                      <select
                        className={inputClass}
                        onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Priority }))}
                        value={draft.priority}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3 [&_input]:min-w-0">
                    <FormField label="Assign to">
                      <select
                        className={inputClass}
                        onChange={(event) => setDraft((current) => ({ ...current, assignedTo: Number(event.target.value) }))}
                        value={draft.assignedTo}
	                      >
	                        {state.members.length === 0 && <option value={0}>No active members</option>}
	                        {state.members.map((member) => (
	                          <option key={member.id} value={member.id}>{member.name}</option>
	                        ))}
	                      </select>
                    </FormField>
                    <FormField label="Due / end">
                      <input
                        className={cn(inputClass, 'min-w-0')}
                        onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))}
                        type="datetime-local"
                        value={draft.dueAt}
                      />
                    </FormField>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <FormField label="Reminder time">
                      <input
                        className={inputClass}
                        onChange={(event) => setDraft((current) => ({ ...current, reminderAt: event.target.value }))}
                        type="datetime-local"
                        value={draft.reminderAt ?? ''}
                      />
                    </FormField>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {reminderLeadOptions.map((option) => (
                        <button
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                          key={option.minutes}
                          onClick={() => applyReminderLead(option.minutes)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
                      <FormField label="Repeat">
                        <select
                          className={inputClass}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              recurrenceType: event.target.value as RecurrenceType,
                              recurrenceInterval: event.target.value === 'none' ? 1 : current.recurrenceInterval || 1,
                              recurrenceEndAt: event.target.value === 'none' ? null : current.recurrenceEndAt,
                            }))
                          }
                          value={draft.recurrenceType ?? 'none'}
                        >
                          {recurrenceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Every">
                        <input
                          className={inputClass}
                          disabled={(draft.recurrenceType ?? 'none') === 'none'}
                          min={1}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, recurrenceInterval: Number(event.target.value) || 1 }))
                          }
                          type="number"
                          value={draft.recurrenceInterval ?? 1}
                        />
                      </FormField>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                      <FormField label="Repeat ends">
                        <input
                          className={inputClass}
                          disabled={(draft.recurrenceType ?? 'none') === 'none'}
                          onChange={(event) => setDraft((current) => ({ ...current, recurrenceEndAt: event.target.value }))}
                          type="datetime-local"
                          value={draft.recurrenceEndAt ?? ''}
                        />
                      </FormField>
                      <span className="pb-2 text-[11px] font-semibold text-violet-600">{repeatUnitLabel}</span>
                    </div>
                  </div>
                  <Button type="submit" className="mt-1">
                    <Plus className="size-4" aria-hidden="true" />
                    Add task
                  </Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Focus Mode</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Highest priority active reminders</p>
              </div>
              <Target className="size-5 text-indigo-500" aria-hidden="true" />
            </CardHeader>
            <CardContent className="grid gap-3">
              {focusedTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
                  <CheckCircle2 className="mx-auto size-7 text-emerald-500" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">No active reminders in this view</p>
                </div>
              ) : (
                focusedTasks.map((task) => {
                  const member = state.members.find((item) => item.id === task.assignedTo)
                  return (
                    <button
                      className="hover-card grid gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-left"
                      disabled={!canManageTasks}
                      key={task.id}
                      onClick={() => toggleTaskStatus(task.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-400">{member?.name ?? 'Unassigned'} - {formatDueLabel(task.dueAt, state.family.timezone)}</p>
                        </div>
                        <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                        <AlertTriangle className="size-3.5 text-amber-500" aria-hidden="true" />
                        Tap to complete this reminder
                      </div>
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Schedule Signals */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule Signals</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Automation and queue health</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="group rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 p-5 transition-all duration-200 hover:shadow-sm">
                <CalendarPlus className="mb-3 size-6 text-indigo-500 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-900">Recurring coverage</p>
                <p className="mt-1 text-xs text-slate-500">
                  {state.tasks.filter((task) => task.recurrenceType !== 'none').length} tasks repeat automatically
                </p>
              </div>
              <div className="group rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 transition-all duration-200 hover:shadow-sm">
                <Clock3 className="mb-3 size-6 text-amber-500 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-900">Reminder queue</p>
                <p className="mt-1 text-xs text-slate-500">
                  {state.tasks.filter((task) => task.status !== 'completed').length} active reminders pending
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={closeTaskDetails}
        >
          <section
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={priorityTone[selectedTask.priority]}>{selectedTask.priority}</Badge>
                  <Badge tone={selectedTask.status === 'completed' ? 'green' : 'indigo'}>{statusLabel[selectedTask.status]}</Badge>
                  {selectedTaskMissed > 0 && <Badge tone="rose">{selectedTaskMissed} carried</Badge>}
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-950">{selectedTask.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedTask.description || 'No note added'}</p>
              </div>
              <button
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                onClick={closeTaskDetails}
                type="button"
              >
                <span className="sr-only">Close task details</span>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Assigned alert</p>
                <div className="mt-3 flex items-center gap-3">
                  {selectedTaskMember && (
                    <Avatar
                      className="size-10"
                      colorClass={selectedTaskMember.colorClass}
                      initial={selectedTaskMember.initial}
                      label={selectedTaskMember.name}
                    />
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedTaskMember?.name ?? 'Unassigned'}</p>
                    <p className="text-xs text-slate-500">{reminderStateLabel(selectedTask, familyToday, state.family.timezone)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Due / end</p>
                <p className="mt-3 text-sm font-bold text-slate-900">{formatDueLabel(selectedTask.dueAt, state.family.timezone)}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedTask.category}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <p className="text-xs font-bold uppercase text-violet-500">Repeat rule</p>
                <p className="mt-3 text-sm font-bold text-violet-800">{repeatLabel(selectedTask)}</p>
                <p className="mt-1 text-xs text-violet-600">
                  {selectedTask.anchorDueAt ? `Anchored from ${formatCompactDate(selectedTask.anchorDueAt.slice(0, 10))}` : 'Single scheduled date'}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                <p className="text-xs font-bold uppercase text-rose-500">Open window</p>
                <p className="mt-3 text-sm font-bold text-rose-800">
                  {selectedTaskMissed > 0 ? `${selectedTaskMissed} prior occurrence${selectedTaskMissed === 1 ? '' : 's'} still open` : 'No prior open occurrence'}
                </p>
                <p className="mt-1 text-xs text-rose-600">Status remains visible until completed or cancelled</p>
              </div>
            </div>

            {taskEditDraft && (
              <form className="border-t border-slate-100 px-5 py-5" onSubmit={handleTaskEditSave}>
                <fieldset className="m-0 grid gap-4 border-0 p-0" disabled={!canManageTasks || state.members.length === 0}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">Edit task rule</p>
                      <p className="mt-0.5 text-xs text-slate-400">Changes update the task and its future recurrence matching this rule.</p>
                    </div>
                    <Button type="submit">
                      <Save className="size-4" aria-hidden="true" />
                      Save task
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr]">
                    <FormField label="Title">
                      <input
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, title: event.target.value } : current)}
                        value={taskEditDraft.title}
                      />
                    </FormField>
                    <FormField label="Status">
                      <select
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, status: event.target.value as TaskStatus } : current)}
                        value={taskEditDraft.status}
                      >
                        {Object.entries(statusLabel).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Priority">
                      <select
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, priority: event.target.value as Priority } : current)}
                        value={taskEditDraft.priority}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Note">
                    <textarea
                      className={cn(inputClass, 'min-h-20 resize-y leading-relaxed')}
                      onChange={(event) => setTaskEditDraft((current) => current ? { ...current, description: event.target.value } : current)}
                      value={taskEditDraft.description ?? ''}
                    />
                  </FormField>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Category">
                      <input
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, category: event.target.value } : current)}
                        value={taskEditDraft.category}
                      />
                    </FormField>
                    <FormField label="Assign to">
                      <select
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, assignedTo: Number(event.target.value) } : current)}
                        value={taskEditDraft.assignedTo}
                      >
                        {state.members.map((member) => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Due / end">
                      <input
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, dueAt: event.target.value } : current)}
                        type="datetime-local"
                        value={taskEditDraft.dueAt}
                      />
                    </FormField>
                    <FormField label="Reminder time">
                      <input
                        className={inputClass}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, reminderAt: event.target.value } : current)}
                        type="datetime-local"
                        value={taskEditDraft.reminderAt ?? ''}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-3 sm:grid-cols-[1fr_120px_1fr]">
                    <FormField label="Repeat">
                      <select
                        className={inputClass}
                        data-testid="task-edit-repeat"
                        onChange={(event) =>
                          setTaskEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  recurrenceType: event.target.value as RecurrenceType,
                                  recurrenceInterval: event.target.value === 'none' ? 1 : current.recurrenceInterval || 1,
                                  recurrenceEndAt: event.target.value === 'none' ? null : current.recurrenceEndAt,
                                }
                              : current,
                          )
                        }
                        value={taskEditDraft.recurrenceType ?? 'none'}
                      >
                        {recurrenceOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Every">
                      <input
                        className={inputClass}
                        data-testid="task-edit-interval"
                        disabled={(taskEditDraft.recurrenceType ?? 'none') === 'none'}
                        min={1}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, recurrenceInterval: Number(event.target.value) || 1 } : current)}
                        type="number"
                        value={taskEditDraft.recurrenceInterval ?? 1}
                      />
                    </FormField>
                    <FormField label="Repeat ends">
                      <input
                        className={inputClass}
                        disabled={(taskEditDraft.recurrenceType ?? 'none') === 'none'}
                        onChange={(event) => setTaskEditDraft((current) => current ? { ...current, recurrenceEndAt: event.target.value } : current)}
                        type="datetime-local"
                        value={taskEditDraft.recurrenceEndAt ?? ''}
                      />
                    </FormField>
                  </div>
                </fieldset>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
