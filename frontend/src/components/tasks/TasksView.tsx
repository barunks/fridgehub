import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
  Clock3,
  GripVertical,
  ListFilter,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { FamilyMember, NewTaskInput, Priority, RecurrenceType, Task, TaskStatus } from '@/types/familyHub'
import { dateTimeOffsetIso, formatDueLabel } from '@/utils/date'
import { cn } from '@/utils/style'

const priorityTone: Record<Priority, 'green' | 'amber' | 'rose'> = {
  low: 'green',
  medium: 'amber',
  high: 'rose',
}

const priorityGradient: Record<Priority, string> = {
  low: 'from-emerald-500/10 to-teal-500/5',
  medium: 'from-amber-500/10 to-orange-500/5',
  high: 'from-rose-500/10 to-pink-500/5',
}

const statusLabel: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const recurrenceOptions: RecurrenceType[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']

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

interface TaskCardProps {
  canManageTasks: boolean
  member?: FamilyMember
  members: FamilyMember[]
  reassignTask: (taskId: number, memberId: number) => void
  task: Task
  toggleTaskStatus: (taskId: number) => void
}

const TaskCard = ({ canManageTasks, member, members, reassignTask, task, toggleTaskStatus }: TaskCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
    disabled: !canManageTasks,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const isCompleted = task.status === 'completed'

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white p-4 transition-all duration-300',
        isDragging
          ? 'opacity-40 ring-2 ring-indigo-400 shadow-xl border-indigo-200'
          : isCompleted
            ? 'border-emerald-100 shadow-sm hover:shadow-md'
            : 'border-slate-100/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5',
      )}
      data-testid={`task-card-${task.id}`}
      ref={setNodeRef}
      style={style}
    >
      {/* Subtle gradient background based on priority */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', priorityGradient[task.priority])} />

      <div className="relative grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <button
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-500"
            data-testid={`drag-task-${task.id}`}
            disabled={!canManageTasks}
            title={`Drag ${task.title}`}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden="true" />
            <span className="sr-only">Move {task.title}</span>
          </button>
          {member && <Avatar className="size-9" colorClass={member.colorClass} initial={member.initial} label={member.name} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn('text-sm font-semibold', isCompleted ? 'text-slate-400 line-through' : 'text-slate-900')}>
                {task.title}
              </h3>
              <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{task.description}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-slate-100 px-2 py-1 text-[11px] text-slate-500 shadow-sm">
                <Clock3 className="size-3 text-indigo-400" aria-hidden="true" />
                {formatDueLabel(task.dueAt)}
              </span>
              {task.recurrenceType !== 'none' && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 border border-violet-100 px-2 py-1 text-[11px] text-violet-600">
                  <RotateCcw className="size-3" aria-hidden="true" />
                  {task.recurrenceType}
                </span>
              )}
              <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] text-slate-400">
                {task.category}
              </span>
            </div>
          </div>
        </div>

        {/* Reassign and complete controls */}
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <select
            aria-label={`Reassign ${task.title}`}
            className="min-h-9 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            disabled={!canManageTasks}
            onChange={(event) => reassignTask(task.id, Number(event.target.value))}
            value={task.assignedTo}
          >
            {members.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button
            className={cn(
              'group/btn flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-95',
              isCompleted
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:shadow-sm'
                : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:from-indigo-400 hover:to-blue-400',
            )}
            onClick={() => toggleTaskStatus(task.id)}
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
    </article>
  )
}

interface TaskLaneProps extends TaskCardProps {
  member: FamilyMember
  tasks: Task[]
}

const TaskLane = ({ canManageTasks, member, members, reassignTask, tasks, toggleTaskStatus }: Omit<TaskLaneProps, 'task'>) => {
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
              key={task.id}
              member={member}
              members={members}
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
  const { state, addTask, reassignTask, toggleTaskStatus, loadTaskPage } = store
  const canManageTasks = store.can('manage_tasks')
  const page = store.pagination.tasks
  const pageTasks = store.paged.tasks ?? state.tasks
  const [category, setCategory] = useState('all')
  const [assignee, setAssignee] = useState<number | 'all'>('all')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const [draft, setDraft] = useState<NewTaskInput>({
    title: '',
    category: 'chore',
    priority: 'medium',
    dueAt: dateTimeOffsetIso(0, 18).slice(0, 16),
    assignedTo: state.members[0]?.id ?? 1,
    recurrenceType: 'none',
  })

  useEffect(() => {
    loadTaskPage(0, status)
  }, [loadTaskPage, status])

  const categories = useMemo(() => Array.from(new Set(state.tasks.map((task) => task.category))), [state.tasks])

  const filteredTasks = useMemo(() => {
    return pageTasks.filter((task) => {
      const matchesCategory = category === 'all' || task.category === category
      const matchesAssignee = assignee === 'all' || task.assignedTo === assignee
      const matchesStatus = status === 'all' || task.status === status
      return matchesCategory && matchesAssignee && matchesStatus
    })
  }, [assignee, category, pageTasks, status])

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All statuses' },
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
    return state.members.reduce<Record<number, Task[]>>((accumulator, member) => {
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.title.trim()) return
    addTask({
      ...draft,
      title: draft.title.trim(),
      dueAt: new Date(draft.dueAt).toISOString(),
    })
    setDraft((current) => ({ ...current, title: '' }))
  }

  const totalActive = state.tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length
  const totalCompleted = state.tasks.filter((t) => t.status === 'completed').length

  return (
    <div className="grid gap-6">
      {/* Header with stats */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tasks & Reminders</h2>
          <p className="mt-1 text-sm text-slate-400">Manage assignments, track progress, and stay on schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-2">
            <div className="size-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-semibold text-indigo-700">{totalActive} active</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{totalCompleted} done</span>
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
                  <p className="text-[11px] font-bold uppercase text-slate-400">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <button
                        className={chipClass(status === option.value)}
                        key={option.value}
                        onClick={() => setStatus(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Category</p>
                  <div className="flex flex-wrap gap-2">
                    <button className={chipClass(category === 'all')} onClick={() => setCategory('all')} type="button">
                      All categories
                    </button>
                    {categories.map((item) => (
                      <button className={chipClass(category === item)} key={item} onClick={() => setCategory(item)} type="button">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Assignee</p>
                  <div className="flex flex-wrap gap-2">
                    <button className={chipClass(assignee === 'all')} onClick={() => setAssignee('all')} type="button">
                      <UserRound className="size-4" aria-hidden="true" />
                      Everyone
                    </button>
                    {state.members.map((member) => (
                      <button
                        className={chipClass(assignee === member.id)}
                        key={member.id}
                        onClick={() => setAssignee(member.id)}
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
                      key={member.id}
                      member={member}
                      members={state.members}
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
                    onClick={() => loadTaskPage(page.offset - page.limit, status)}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!page.hasNext || page.isLoading}
                    onClick={() => loadTaskPage(page.offset + page.limit, status)}
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
                <fieldset className="m-0 grid gap-3.5 border-0 p-0" disabled={!canManageTasks}>
                  <FormField label="Title">
                    <input
                      className={inputClass}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Water plants, pick up groceries..."
                      value={draft.title}
                    />
                  </FormField>
                  <FormField label="Category">
                    <input
                      className={inputClass}
                      onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                      value={draft.category}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
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
                    <FormField label="Assign to">
                      <select
                        className={inputClass}
                        onChange={(event) => setDraft((current) => ({ ...current, assignedTo: Number(event.target.value) }))}
                        value={draft.assignedTo}
                      >
                        {state.members.map((member) => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Due date">
                    <input
                      className={inputClass}
                      onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))}
                      type="datetime-local"
                      value={draft.dueAt}
                    />
                  </FormField>
                  <FormField label="Recurrence">
                    <select
                      className={inputClass}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, recurrenceType: event.target.value as RecurrenceType }))
                      }
                      value={draft.recurrenceType ?? 'none'}
                    >
                      {recurrenceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'none' ? 'None (one-time)' : option}
                        </option>
                      ))}
                    </select>
                  </FormField>
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
                          <p className="mt-1 text-xs text-slate-400">{member?.name ?? 'Unassigned'} - {formatDueLabel(task.dueAt)}</p>
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
    </div>
  )
}
