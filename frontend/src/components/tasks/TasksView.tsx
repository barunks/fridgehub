import { useMemo, useState } from 'react'
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
  member?: FamilyMember
  task: Task
  toggleTaskStatus: (taskId: number) => void
}

const TaskCard = ({ member, task, toggleTaskStatus }: TaskCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <article
      className={cn(
        'rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition',
        isDragging && 'opacity-40 ring-2 ring-blue-300',
      )}
      data-testid={`task-card-${task.id}`}
      ref={setNodeRef}
      style={style}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <button
            className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-white hover:text-blue-600"
            data-testid={`drag-task-${task.id}`}
            title={`Drag ${task.title}`}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden="true" />
            <span className="sr-only">Move {task.title}</span>
          </button>
          {member && <Avatar colorClass={member.colorClass} initial={member.initial} label={member.name} />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-950">{task.title}</h3>
              <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
              <Badge tone={task.status === 'completed' ? 'green' : 'blue'}>{statusLabel[task.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{task.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {formatDueLabel(task.dueAt)}
              </span>
              <span className="rounded-md bg-slate-50 px-2 py-1">{task.recurrenceType}</span>
              <span className="rounded-md bg-slate-50 px-2 py-1">{task.category}</span>
            </div>
          </div>
        </div>
        <button
          className={cn(
            'flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition',
            task.status === 'completed'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
          onClick={() => toggleTaskStatus(task.id)}
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

const TaskLane = ({ member, tasks, toggleTaskStatus }: Omit<TaskLaneProps, 'task'>) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `member-${member.id}`,
    data: { memberId: member.id },
  })

  return (
    <section
      className={cn(
        'grid min-h-48 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 transition',
        isOver && 'border-blue-300 bg-blue-50 ring-2 ring-blue-100',
      )}
      data-testid={`member-lane-${member.id}`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar colorClass={member.colorClass} initial={member.initial} label={member.name} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-950">{member.name}</h3>
            <p className="truncate text-xs text-slate-500">{member.role}</p>
          </div>
        </div>
        <Badge tone="slate">{tasks.length}</Badge>
      </div>

      {tasks.length > 0 ? (
        tasks.map((task) => (
          <TaskCard key={task.id} member={member} task={task} toggleTaskStatus={toggleTaskStatus} />
        ))
      ) : (
        <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-200 bg-white px-3 text-center text-sm text-slate-500">
          Drop reminders here
        </div>
      )}
    </section>
  )
}

export const TasksView = ({ store }: { store: FamilyHubStore }) => {
  const { state, addTask, reassignTask, toggleTaskStatus } = store
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

  const categories = useMemo(() => Array.from(new Set(state.tasks.map((task) => task.category))), [state.tasks])

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((task) => {
      const matchesCategory = category === 'all' || task.category === category
      const matchesAssignee = assignee === 'all' || task.assignedTo === assignee
      const matchesStatus = status === 'all' || task.status === status

      return matchesCategory && matchesAssignee && matchesStatus
    })
  }, [assignee, category, state.tasks, status])

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

    if (!draft.title.trim()) {
      return
    }

    addTask({
      ...draft,
      title: draft.title.trim(),
      dueAt: new Date(draft.dueAt).toISOString(),
    })
    setDraft((current) => ({ ...current, title: '' }))
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Tasks and Reminders</h2>
          <p className="mt-1 text-sm text-slate-500">Due dates, recurrence, assignments, and reminder status</p>
        </div>
        <Badge tone="blue">Reminder board</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Card>
            <CardContent className="grid gap-3 lg:grid-cols-4">
              <FormField label="Category">
                <select className={inputClass} onChange={(event) => setCategory(event.target.value)} value={category}>
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
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
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
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
                    <option key={key} value={key}>
                      {label}
                    </option>
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
              <p className="mt-1 text-sm text-slate-500">Drag reminders between members to rebalance chores and follow-ups</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
                <div className="grid gap-3 xl:grid-cols-2">
                  {state.members.map((member) => (
                    <TaskLane
                      key={member.id}
                      member={member}
                      tasks={tasksByMember[member.id] ?? []}
                      toggleTaskStatus={toggleTaskStatus}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask ? (
                    <article className="w-[min(32rem,90vw)] rounded-lg border border-blue-200 bg-white p-4 shadow-2xl">
                      <h3 className="font-semibold text-slate-950">{activeTask.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{activeTask.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={priorityTone[activeTask.priority]}>{activeTask.priority}</Badge>
                        <Badge tone={activeTask.status === 'completed' ? 'green' : 'blue'}>
                          {statusLabel[activeTask.status]}
                        </Badge>
                      </div>
                    </article>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Reminder</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={handleSubmit}>
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
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
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
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Signals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <CalendarPlus className="mb-3 size-5 text-blue-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-blue-950">Recurring coverage</p>
                <p className="mt-1 text-sm text-blue-700">
                  {state.tasks.filter((task) => task.recurrenceType !== 'none').length} tasks repeat automatically.
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <Clock3 className="mb-3 size-5 text-amber-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-amber-950">Reminder queue</p>
                <p className="mt-1 text-sm text-amber-700">
                  {state.tasks.filter((task) => task.status !== 'completed').length} active reminders are pending.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
