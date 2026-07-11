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
import { CalendarPlus, CheckCircle2, Clock3, Filter, GripVertical, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { FamilyMember, NewTaskInput, Priority, Task, TaskStatus } from '@/types/familyHub'
import { dateTimeOffsetIso, formatDueLabel } from '@/utils/date'
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

interface TaskCardProps {
  canManageTasks: boolean
  member?: FamilyMember
  task: Task
  toggleTaskStatus: (taskId: number) => void
}

const TaskCard = ({ canManageTasks, member, task, toggleTaskStatus }: TaskCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
    disabled: !canManageTasks,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <article
      className={cn(
        'rounded-xl border border-slate-100/80 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-200',
        isDragging && 'opacity-40 ring-2 ring-indigo-300 shadow-lg',
      )}
      data-testid={`task-card-${task.id}`}
      ref={setNodeRef}
      style={style}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <button
            className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
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
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
              <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
              <Badge tone={task.status === 'completed' ? 'green' : 'indigo'}>{statusLabel[task.status]}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{task.description}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                <Clock3 className="size-3" aria-hidden="true" />
                {formatDueLabel(task.dueAt)}
              </span>
              <span className="rounded-lg bg-slate-50 px-2 py-1">{task.recurrenceType}</span>
              <span className="rounded-lg bg-slate-50 px-2 py-1">{task.category}</span>
            </div>
          </div>
        </div>
        <button
          className={cn(
            'flex min-h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all duration-200',
            task.status === 'completed'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200',
          )}
          onClick={() => toggleTaskStatus(task.id)}
          disabled={!canManageTasks}
          type="button"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {task.status === 'completed' ? 'Reopen' : 'Complete'}
        </button>
      </div>
    </article>
  )
}

interface TaskLaneProps extends TaskCardProps {
  member: FamilyMember
  tasks: Task[]
}

const TaskLane = ({ canManageTasks, member, tasks, toggleTaskStatus }: Omit<TaskLaneProps, 'task'>) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `member-${member.id}`,
    data: { memberId: member.id },
  })

  return (
    <section
      className={cn(
        'grid min-h-48 gap-3 rounded-2xl border border-slate-100/80 bg-slate-50/50 p-4 transition-all duration-200',
        isOver && 'border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-100 shadow-md',
      )}
      data-testid={`member-lane-${member.id}`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="size-9" colorClass={member.colorClass} initial={member.initial} label={member.name} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{member.name}</h3>
            <p className="truncate text-[11px] text-slate-400">{member.role}</p>
          </div>
        </div>
        <Badge tone="slate">{tasks.length}</Badge>
      </div>

      {tasks.length > 0 ? (
        tasks.map((task) => (
          <TaskCard
            canManageTasks={canManageTasks}
            key={task.id}
            member={member}
            task={task}
            toggleTaskStatus={toggleTaskStatus}
          />
        ))
      ) : (
        <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-200/80 bg-white/50 px-3 text-center text-xs text-slate-400">
          Drop reminders here
        </div>
      )}
    </section>
  )
}

export const TasksView = ({ store }: { store: FamilyHubStore }) => {
  const { state, addTask, reassignTask, toggleTaskStatus } = store
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
    store.loadTaskPage(0, status)
  }, [store, status])

  const categories = useMemo(() => Array.from(new Set(state.tasks.map((task) => task.category))), [state.tasks])

  const filteredTasks = useMemo(() => {
    return pageTasks.filter((task) => {
      const matchesCategory = category === 'all' || task.category === category
      const matchesAssignee = assignee === 'all' || task.assignedTo === assignee
      const matchesStatus = status === 'all' || task.status === status
      return matchesCategory && matchesAssignee && matchesStatus
    })
  }, [assignee, category, pageTasks, status])

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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tasks & Reminders</h2>
          <p className="mt-1 text-sm text-slate-400">Due dates, recurrence, assignments, and status</p>
        </div>
        <Badge tone="indigo">Reminder board</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Card>
            <CardContent className="grid gap-3 lg:grid-cols-4">
              <FormField label="Category">
                <select className={inputClass} onChange={(event) => setCategory(event.target.value)} value={category}>
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Assignee">
                <select
                  className={inputClass}
                  onChange={(event) => setAssignee(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                  value={assignee}
                >
                  <option value="all">Everyone</option>
                  {state.members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select
                  className={inputClass}
                  onChange={(event) => setStatus(event.target.value as TaskStatus | 'all')}
                  value={status}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabel).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </FormField>
              <div className="flex items-end">
                <Button className="w-full" variant="secondary">
                  <Filter className="size-4" aria-hidden="true" />
                  {filteredTasks.length} shown
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment Board</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Drag reminders between members to reassign</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
                <div className="grid gap-4 xl:grid-cols-2">
                  {state.members.map((member) => (
                    <TaskLane
                      canManageTasks={canManageTasks}
                      key={member.id}
                      member={member}
                      tasks={tasksByMember[member.id] ?? []}
                      toggleTaskStatus={toggleTaskStatus}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask ? (
                    <article className="w-[min(32rem,90vw)] rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xl">
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">
                  Page {Math.floor(page.offset / page.limit) + 1} - {filteredTasks.length} loaded
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={page.offset === 0 || page.isLoading}
                    onClick={() => store.loadTaskPage(page.offset - page.limit, status)}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!page.hasNext || page.isLoading}
                    onClick={() => store.loadTaskPage(page.offset + page.limit, status)}
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Add Reminder</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3.5" onSubmit={handleSubmit}>
                <fieldset className="m-0 grid gap-3.5 border-0 p-0" disabled={!canManageTasks}>
                <FormField label="Title">
                  <input
                    className={inputClass}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Water plants"
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
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </FormField>
                  <FormField label="Assign">
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
                <FormField label="Due">
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
                    onChange={(event) => setDraft((current) => ({ ...current, recurrenceType: event.target.value as any }))}
                    value={draft.recurrenceType ?? 'none'}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </FormField>
                <Button type="submit">
                  <Plus className="size-4" aria-hidden="true" />
                  Add task
                </Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Signals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-xl bg-indigo-50/80 p-4">
                <CalendarPlus className="mb-2.5 size-5 text-indigo-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Recurring coverage</p>
                <p className="mt-1 text-xs text-slate-500">
                  {state.tasks.filter((task) => task.recurrenceType !== 'none').length} tasks repeat automatically
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/80 p-4">
                <Clock3 className="mb-2.5 size-5 text-amber-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Reminder queue</p>
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
