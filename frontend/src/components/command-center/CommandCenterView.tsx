import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  Bot,
  CalendarDays,
  ChefHat,
  Copy,
  ClipboardCheck,
  ClipboardList,
  Eye,
  EyeOff,
  Key,
  Pencil,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  ShoppingBasket,
  Sparkles,
  Store,
  Trash2,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import { api } from '@/services/api'
import type {
  DeviceInfo,
  DevicePolicy,
  MealPlanItem,
  MealTemplateRow,
  MealType,
  NewTaskInput,
  Priority,
  Recipe,
  RecurrenceType,
  SignupInvite,
  TaskStatus,
  TaskUpdateInput,
} from '@/types/familyHub'
import { cn } from '@/utils/style'

type Tab = 'members' | 'contacts' | 'grocery-types' | 'meal-plans' | 'recipes' | 'tasks' | 'insights' | 'security'

const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'members', label: 'Members', icon: Users },
  { key: 'meal-plans', label: 'Meal Plans', icon: CalendarDays },
  { key: 'contacts', label: 'Contacts', icon: Phone },
  { key: 'grocery-types', label: 'Grocery Places', icon: Store },
  { key: 'recipes', label: 'Recipes', icon: ChefHat },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList },
  { key: 'insights', label: 'Insights', icon: Bot },
  { key: 'security', label: 'Security', icon: Key },
]

interface Props {
  store: FamilyHubStore
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

export const CommandCenterView = ({ store }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('members')

  return (
    <div className="grid gap-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900 px-6 py-8 text-white shadow-xl shadow-slate-500/20 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-indigo-500/10 blur-2xl animate-[moonFloat_7s_ease-in-out_infinite]" />
          <div className="absolute -bottom-20 -left-20 size-72 rounded-full bg-purple-500/[0.08] blur-3xl animate-[moonFloat_9s_ease-in-out_infinite_2s]" />
          <div className="absolute left-[15%] top-[25%] size-2 rounded-full bg-amber-300/60 animate-[starTwinkle_2s_ease-in-out_infinite]" />
          <div className="absolute left-[60%] top-[60%] size-1.5 rounded-full bg-indigo-300/50 animate-[starTwinkle_2.8s_ease-in-out_infinite_1s]" />
          <div className="absolute left-[85%] top-[20%] size-2 rounded-full bg-teal-300/40 animate-[starTwinkle_3s_ease-in-out_infinite_0.5s]" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 shadow-lg backdrop-blur-sm">
            <Sparkles className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Household Command Center</h1>
            <p className="mt-0.5 text-sm text-slate-300">Manage all family resources in one place</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 p-1.5 shadow-sm backdrop-blur-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all',
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
              )}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in-up">
        {activeTab === 'members' && <MembersPanel store={store} />}
        {activeTab === 'meal-plans' && <MealPlansPanel store={store} />}
        {activeTab === 'contacts' && <ContactsPanel store={store} />}
        {activeTab === 'grocery-types' && <GroceryTypesPanel store={store} />}
        {activeTab === 'recipes' && <RecipesPanel store={store} />}
        {activeTab === 'tasks' && <TasksPanel store={store} />}
        {activeTab === 'insights' && <InsightsPanel store={store} />}
        {activeTab === 'security' && <SecurityPanel store={store} />}
      </div>
    </div>
  )
}

/* ─── Members Panel ─── */
const MembersPanel = ({ store }: Props) => {
  const { state, addMember, updateMember, deleteMember } = store
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', email: '', username: '', password: '', role: 'child', colorClass: 'bg-blue-500' })
  const [editForm, setEditForm] = useState({ name: '', role: 'child', colorClass: 'bg-blue-500' })

  const handleSubmit = () => {
    if (editId) {
      if (!editForm.name.trim()) return
      updateMember(editId, { name: editForm.name, role: editForm.role, colorClass: editForm.colorClass })
      setEditId(null)
      setEditForm({ name: '', role: 'child', colorClass: 'bg-blue-500' })
    } else {
      if (!createForm.name.trim() || !createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) return
      addMember(createForm)
      setCreateForm({ name: '', email: '', username: '', password: '', role: 'child', colorClass: 'bg-blue-500' })
    }
    setShowForm(false)
  }

  const startEdit = (id: number) => {
    const m = state.members.find((x) => x.id === id)
    if (!m) return
    setEditForm({ name: m.name, role: m.role, colorClass: m.colorClass })
    setEditId(id)
    setShowForm(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Family Members ({state.members.length})</CardTitle>
        <Button variant="outline" onClick={() => { setShowForm(!showForm); setEditId(null) }}>
          <Plus className="size-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {showForm && (
          <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            {editId && (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500">
                Account username, email, and password are set when a member is created. This edit updates the visible profile and role only.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Name">
                <input
                  className={inputClass}
                  value={editId ? editForm.name : createForm.name}
                  onChange={(e) => editId
                    ? setEditForm((current) => ({ ...current, name: e.target.value }))
                    : setCreateForm((current) => ({ ...current, name: e.target.value }))
                  }
                />
              </FormField>
              {!editId && (
                <>
                  <FormField label="Username">
                    <input
                      className={inputClass}
                      value={createForm.username}
                      onChange={(e) => setCreateForm((current) => ({ ...current, username: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Email">
                    <input
                      className={inputClass}
                      value={createForm.email}
                      onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Password">
                    <input
                      className={inputClass}
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((current) => ({ ...current, password: e.target.value }))}
                    />
                  </FormField>
                </>
              )}
              <FormField label="Role">
                <select
                  className={inputClass}
                  value={editId ? editForm.role : createForm.role}
                  onChange={(e) => editId
                    ? setEditForm((current) => ({ ...current, role: e.target.value }))
                    : setCreateForm((current) => ({ ...current, role: e.target.value }))
                  }
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                </select>
              </FormField>
              <FormField label="Color">
                <select
                  className={inputClass}
                  value={editId ? editForm.colorClass : createForm.colorClass}
                  onChange={(e) => editId
                    ? setEditForm((current) => ({ ...current, colorClass: e.target.value }))
                    : setCreateForm((current) => ({ ...current, colorClass: e.target.value }))
                  }
                >
                  <option value="bg-blue-500">Blue</option>
                  <option value="bg-emerald-500">Green</option>
                  <option value="bg-amber-500">Amber</option>
                  <option value="bg-rose-500">Rose</option>
                  <option value="bg-violet-500">Violet</option>
                  <option value="bg-slate-500">Slate</option>
                </select>
              </FormField>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>{editId ? 'Update' : 'Create'}</Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
            </div>
          </div>
        )}
        {state.members.map((m) => (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm" key={m.id}>
            <div className="flex items-center gap-3">
              <div className={cn('flex size-9 items-center justify-center rounded-full text-sm font-bold text-white', m.colorClass)}>{m.initial}</div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">{m.role} · {m.points} pts</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="icon" iconOnly onClick={() => startEdit(m.id)} title="Edit"><Pencil className="size-3.5" /></Button>
              <Button variant="icon" iconOnly onClick={() => setDeleteId(m.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog open={deleteId !== null} title="Remove member?" message="This will permanently remove this family member." confirmLabel="Remove" onConfirm={() => { if (deleteId) deleteMember(deleteId); setDeleteId(null) }} onCancel={() => setDeleteId(null)} />
    </Card>
  )
}

/* ─── Contacts Panel ─── */
const ContactsPanel = ({ store }: Props) => {
  const { state, addEmergencyContact, updateEmergencyContact, deleteEmergencyContact } = store
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ label: '', value: '' })

  const handleSubmit = () => {
    if (!form.label.trim() || !form.value.trim()) return
    if (editId) updateEmergencyContact(editId, form)
    else addEmergencyContact(form.label, form.value)
    setShowForm(false)
    setEditId(null)
    setForm({ label: '', value: '' })
  }

  const startEdit = (id: number) => {
    const c = state.emergencyContacts.find((x) => x.id === id)
    if (!c) return
    setForm({ label: c.label, value: c.value })
    setEditId(id)
    setShowForm(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Emergency Contacts ({state.emergencyContacts.length})</CardTitle>
        <Button variant="outline" onClick={() => { setShowForm(!showForm); setEditId(null) }}>
          <Plus className="size-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {showForm && (
          <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 sm:grid-cols-2">
            <FormField label="Label"><input className={inputClass} placeholder="e.g. Ambulance" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></FormField>
            <FormField label="Number"><input className={inputClass} placeholder="995" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></FormField>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={handleSubmit}>{editId ? 'Update' : 'Add'}</Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
            </div>
          </div>
        )}
        {state.emergencyContacts.map((c) => (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm" key={c.id}>
            <div>
              <p className="text-sm font-semibold text-slate-900">{c.label}</p>
              <p className="text-lg font-bold text-indigo-600">{c.value}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="icon" iconOnly onClick={() => startEdit(c.id)} title="Edit"><Pencil className="size-3.5" /></Button>
              <Button variant="icon" iconOnly onClick={() => deleteEmergencyContact(c.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ─── Grocery Types / List Types Panel ─── */
const GroceryTypesPanel = ({ store }: Props) => {
  const { state, addListType, updateListType, deleteListType, regenerateGroceryCycles } = store
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ listName: '', description: '', colorClass: 'bg-emerald-100 text-emerald-800' })

  const handleSubmit = () => {
    if (!form.listName.trim()) return
    if (editId) updateListType(editId, form)
    else addListType(form.listName, form.description, form.colorClass)
    setShowForm(false)
    setEditId(null)
    setForm({ listName: '', description: '', colorClass: 'bg-emerald-100 text-emerald-800' })
  }

  const startEdit = (id: number) => {
    const lt = state.listTypes.find((x) => x.id === id)
    if (!lt) return
    setForm({ listName: lt.listName, description: lt.description, colorClass: lt.colorClass })
    setEditId(id)
    setShowForm(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Shopping Places / List Types ({state.listTypes.length})</CardTitle>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={regenerateGroceryCycles} title="Regenerate cycles">
            <RefreshCw className="size-4" /> Cycles
          </Button>
          <Button variant="outline" onClick={() => { setShowForm(!showForm); setEditId(null) }}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {showForm && (
          <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 sm:grid-cols-2">
            <FormField label="Name"><input className={inputClass} value={form.listName} onChange={(e) => setForm({ ...form, listName: e.target.value })} /></FormField>
            <FormField label="Description"><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={handleSubmit}>{editId ? 'Update' : 'Add'}</Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
            </div>
          </div>
        )}
        {state.listTypes.map((lt) => (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm" key={lt.id}>
            <div className="flex items-center gap-3">
              <ShoppingBasket className="size-5 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{lt.listName}</p>
                <p className="text-xs text-slate-500">{lt.description}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="icon" iconOnly onClick={() => startEdit(lt.id)} title="Edit"><Pencil className="size-3.5" /></Button>
              <Button variant="icon" iconOnly onClick={() => deleteListType(lt.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ─── Recipes Panel ─── */
const RecipesPanel = ({ store }: Props) => {
  const { state, addRecipe, updateRecipe, deleteRecipe } = store
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({
    recipeName: '',
    description: '',
    cuisine: '',
    difficulty: 'easy' as Recipe['difficulty'],
    prepTime: 0,
    cookTime: 0,
    servings: 4,
  })
  const [filter, setFilter] = useState('')
  const resetRecipeForm = () => {
    setEditId(null)
    setForm({ recipeName: '', description: '', cuisine: '', difficulty: 'easy', prepTime: 0, cookTime: 0, servings: 4 })
  }

  const filtered = filter
    ? state.recipes.filter((r) => r.recipeName.toLowerCase().includes(filter.toLowerCase()) || r.cuisine.toLowerCase().includes(filter.toLowerCase()))
    : state.recipes

  const handleSubmit = () => {
    if (!form.recipeName.trim()) return
    const payload = {
      recipeName: form.recipeName.trim(),
      description: form.description.trim(),
      cuisine: form.cuisine.trim(),
      difficulty: form.difficulty,
      prepTime: Math.max(0, Number(form.prepTime) || 0),
      cookTime: Math.max(0, Number(form.cookTime) || 0),
      servings: Math.max(1, Number(form.servings) || 1),
    }
    if (editId) updateRecipe(editId, payload)
    else addRecipe(payload)
    setShowForm(false)
    resetRecipeForm()
  }

  const startEdit = (recipe: Recipe) => {
    setEditId(recipe.id)
    setForm({
      recipeName: recipe.recipeName,
      description: recipe.description,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
    })
    setShowForm(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Recipes ({state.recipes.length})</CardTitle>
        <div className="flex gap-2">
          <input className={cn(inputClass, 'max-w-48')} placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button variant="outline" onClick={() => { if (showForm && !editId) setShowForm(false); else { resetRecipeForm(); setShowForm(true) } }}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {showForm && (
          <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 sm:grid-cols-2">
            <FormField label="Name"><input className={inputClass} value={form.recipeName} onChange={(e) => setForm({ ...form, recipeName: e.target.value })} /></FormField>
            <FormField label="Cuisine"><input className={inputClass} value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} /></FormField>
            <FormField label="Description"><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            <FormField label="Difficulty">
              <select className={inputClass} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </FormField>
            <FormField label="Prep time"><input className={inputClass} min={0} type="number" value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: Number(e.target.value) })} /></FormField>
            <FormField label="Cook time"><input className={inputClass} min={0} type="number" value={form.cookTime} onChange={(e) => setForm({ ...form, cookTime: Number(e.target.value) })} /></FormField>
            <FormField label="Servings"><input className={inputClass} min={1} type="number" value={form.servings} onChange={(e) => setForm({ ...form, servings: Number(e.target.value) })} /></FormField>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={handleSubmit}>{editId ? 'Update' : 'Create'}</Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); resetRecipeForm() }}>Cancel</Button>
            </div>
          </div>
        )}
        {filtered.map((r) => (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm" key={r.id}>
            <div>
              <p className="text-sm font-semibold text-slate-900">{r.recipeName}</p>
              <div className="mt-1 flex gap-2">
                {r.cuisine && <Badge tone="teal">{r.cuisine}</Badge>}
                <Badge tone="violet">{r.difficulty}</Badge>
                <Badge tone="slate">{r.prepTime + r.cookTime}m</Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="icon" iconOnly onClick={() => startEdit(r)} title="Edit recipe"><Pencil className="size-3.5" /></Button>
              <Button variant="icon" iconOnly onClick={() => deleteRecipe(r.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No recipes found</p>}
      </CardContent>
    </Card>
  )
}

/* ─── Tasks Panel ─── */
const TasksPanel = ({ store }: Props) => {
  const { state, addTask, updateTask, deleteTask, toggleTaskStatus } = store
  const [filter, setFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<NewTaskInput & { status: TaskStatus }>({
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
    status: 'pending',
  })

  const filtered = filter === 'all' ? state.tasks : state.tasks.filter((t) => t.status === filter)
  const ownerName = (assignedTo: number) => state.members.find((m) => m.id === assignedTo)?.name ?? '—'
  const resetTaskForm = () => {
    setEditId(null)
    setForm({
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
      status: 'pending',
    })
  }

  const startEdit = (taskId: number) => {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task) return
    setEditId(task.id)
    setForm({
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      dueAt: toDateTimeLocalValue(new Date(task.dueAt)),
      reminderAt: task.reminderAt ? toDateTimeLocalValue(new Date(task.reminderAt)) : '',
      assignedTo: task.assignedTo,
      recurrenceType: task.recurrenceType,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceEndAt: task.recurrenceEndAt ? toDateTimeLocalValue(new Date(task.recurrenceEndAt)) : '',
      status: task.status,
    })
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!form.title.trim() || state.members.length === 0) return
    const recurrenceType = form.recurrenceType ?? 'none'
    const payload: NewTaskInput & TaskUpdateInput = {
      title: form.title.trim(),
      description: form.description?.trim() || '',
      category: form.category.trim() || 'general',
      priority: form.priority,
      assignedTo: form.assignedTo,
      dueAt: new Date(form.dueAt).toISOString(),
      reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
      recurrenceType,
      recurrenceInterval: recurrenceType === 'none' ? 1 : Math.max(1, Number(form.recurrenceInterval) || 1),
      recurrenceEndAt: recurrenceType !== 'none' && form.recurrenceEndAt ? new Date(form.recurrenceEndAt).toISOString() : null,
    }
    if (editId) {
      updateTask(editId, { ...payload, status: form.status })
    } else {
      addTask(payload)
    }
    setShowForm(false)
    resetTaskForm()
  }

  const updateTaskStatus = (taskId: number, status: TaskStatus) => {
    updateTask(taskId, { status })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Tasks ({state.tasks.length})</CardTitle>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Task status filter" className={cn(inputClass, 'max-w-44')} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="outline" onClick={() => { if (showForm && !editId) setShowForm(false); else { resetTaskForm(); setShowForm(true) } }}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {showForm && (
          <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FormField label="Title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField>
              <FormField label="Assignee">
                <select className={inputClass} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: Number(e.target.value) })}>
                  {state.members.length === 0 && <option value={0}>No active members</option>}
                  {state.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </FormField>
              <FormField label="Due / end"><input className={inputClass} type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></FormField>
              <FormField label="Reminder"><input className={inputClass} type="datetime-local" value={form.reminderAt ?? ''} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} /></FormField>
              <FormField label="Priority">
                <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </FormField>
              <FormField label="Category"><input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></FormField>
              <FormField label="Repeat">
                <select
                  className={inputClass}
                  value={form.recurrenceType ?? 'none'}
                  onChange={(e) => setForm({ ...form, recurrenceType: e.target.value as RecurrenceType, recurrenceEndAt: e.target.value === 'none' ? null : form.recurrenceEndAt })}
                >
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annually">Semi-annually</option>
                  <option value="yearly">Yearly</option>
                </select>
              </FormField>
              <FormField label="Every"><input className={inputClass} disabled={(form.recurrenceType ?? 'none') === 'none'} min={1} type="number" value={form.recurrenceInterval ?? 1} onChange={(e) => setForm({ ...form, recurrenceInterval: Number(e.target.value) || 1 })} /></FormField>
              <FormField label="Repeat ends"><input className={inputClass} disabled={(form.recurrenceType ?? 'none') === 'none'} type="datetime-local" value={form.recurrenceEndAt ?? ''} onChange={(e) => setForm({ ...form, recurrenceEndAt: e.target.value })} /></FormField>
              <FormField className="sm:col-span-2" label="Note"><input className={inputClass} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            </div>
            <div className="flex gap-2">
              <Button disabled={state.members.length === 0} onClick={handleSubmit}>{editId ? 'Update task' : 'Create task'}</Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); resetTaskForm() }}>Cancel</Button>
            </div>
          </div>
        )}
        <div className="grid max-h-[500px] gap-2 overflow-y-auto">
        {filtered.map((t) => (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm" key={t.id}>
            <div className="flex items-center gap-3 min-w-0">
              <input type="checkbox" checked={t.status === 'completed'} onChange={() => toggleTaskStatus(t.id)} className="size-4 accent-indigo-600" />
              <div className="min-w-0">
                <p className={cn('truncate text-sm font-semibold', t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900')}>{t.title}</p>
                <p className="text-xs text-slate-500">{ownerName(t.assignedTo)} · {t.priority}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <select aria-label={`Status for ${t.title}`} className={cn(inputClass, 'min-h-9 w-36 px-2 py-1 text-xs')} value={t.status} onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Button variant="icon" iconOnly onClick={() => startEdit(t.id)} title="Edit task"><Pencil className="size-3.5" /></Button>
              <Button variant="icon" iconOnly onClick={() => deleteTask(t.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No tasks match filter</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Insights Panel ─── */
const InsightsPanel = ({ store }: Props) => {
  const [loading, setLoading] = useState(false)
  const insights = store.state.assistantInsights

  const fetchInsights = useCallback(() => {
    setLoading(true)
    store
      .refreshAssistantInsights()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [store])

  const typeColor: Record<string, 'blue' | 'green' | 'amber' | 'rose' | 'violet'> = {
    schedule: 'blue',
    grocery: 'green',
    meal: 'amber',
    task: 'rose',
    family: 'violet',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>AI Assistant Insights</CardTitle>
        <Button variant="outline" onClick={fetchInsights} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {insights.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">No insights available. Ask the assistant a question first.</p>}
        {insights.map((insight) => (
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm" key={insight.id}>
            <div className="flex items-center gap-2">
              <Badge tone={typeColor[insight.type] ?? 'slate'}>{insight.type}</Badge>
              <span className="text-xs text-slate-400">{Math.round(insight.confidence)}% confidence</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{insight.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{insight.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ─── Meal Plans Panel ─── */
const mealTypes: MealType[] = ['breakfast', 'lunch', 'snacks', 'dinner']
const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
type TemplateApplyTarget = 'family' | 'all' | 'member'

const MealPlansPanel = ({ store }: Props) => {
  const { state, applyWeeklyTemplate, applyWeeklyTemplateForAll, loadMemberMeals, memberMeals, memberMealsLoading, updateMeal } = store
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [generating, setGenerating] = useState<number | 'all' | 'family' | 'target' | null>(null)
  const [editingMealId, setEditingMealId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [templates, setTemplates] = useState<MealTemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateName, setSelectedTemplateName] = useState('Default Weekly Meal Plan')
  const [templateTarget, setTemplateTarget] = useState<TemplateApplyTarget>('all')
  const [templateMemberId, setTemplateMemberId] = useState<string>(() => String(state.members[0]?.id ?? ''))

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true)
    api.listMealTemplates().then((rows) => {
      setTemplates(rows)
      if (rows.length > 0) {
        setSelectedTemplateName((current) => (rows.some((row) => row.templateName === current) ? current : rows[0].templateName))
      }
    }).catch(() => {}).finally(() => setTemplatesLoading(false))
  }, [])

  useEffect(() => {
    if (selectedMemberId !== null) loadMemberMeals(selectedMemberId)
  }, [selectedMemberId, loadMemberMeals])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  useEffect(() => {
    if (!templateMemberId && state.members.length > 0) setTemplateMemberId(String(state.members[0].id))
    if (templateMemberId && !state.members.some((member) => String(member.id) === templateMemberId)) {
      setTemplateMemberId(String(state.members[0]?.id ?? ''))
    }
  }, [state.members, templateMemberId])

  const activeMeals: MealPlanItem[] = useMemo(
    () => selectedMemberId !== null
      ? memberMealsLoading
        ? []
        : memberMeals ?? []
      : state.meals,
    [memberMeals, memberMealsLoading, selectedMemberId, state.meals],
  )
  const mealsByDay = useMemo(() => {
    return activeMeals.reduce<Record<string, MealPlanItem[]>>((acc, meal) => {
      acc[meal.dayOfWeek] = [...(acc[meal.dayOfWeek] ?? []), meal]
      return acc
    }, {})
  }, [activeMeals])

  const templateNames = useMemo(() => {
    const names = Array.from(new Set(templates.map((row) => row.templateName))).sort((a, b) => a.localeCompare(b))
    return names.length > 0 ? names : ['Default Weekly Meal Plan']
  }, [templates])

  const generateForMember = async (memberId: number) => {
    setGenerating(memberId)
    await applyWeeklyTemplate(memberId, selectedTemplateName)
    if (selectedMemberId === memberId) {
      loadMemberMeals(memberId)
    }
    setGenerating(null)
  }

  const generateForAll = async () => {
    setGenerating('all')
    await applyWeeklyTemplateForAll(selectedTemplateName)
    if (selectedMemberId !== null) loadMemberMeals(selectedMemberId)
    setGenerating(null)
  }

  const applyTarget = async () => {
    if (templateTarget === 'member' && !templateMemberId) {
      return
    }
    setGenerating('target')
    if (templateTarget === 'all') {
      await generateForAll()
    } else if (templateTarget === 'member' && templateMemberId) {
      await generateForMember(Number(templateMemberId))
    } else {
      await applyWeeklyTemplate(null, selectedTemplateName)
    }
    setGenerating(null)
  }

  const handleSaveMeal = (mealId: number) => {
    if (editName.trim()) updateMeal(mealId, editName.trim())
    setEditingMealId(null)
    setEditName('')
  }

  const memberMealCount = (memberId: number) => {
    return state.meals.filter((m) => m.assignedTo === memberId).length
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Per-Member Meal Plans</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Apply a named weekly template to the shared family plan, all members, or one member.</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_auto] lg:items-end">
            <div className="grid gap-2">
              <FormField label="Template">
                <select className={inputClass} value={selectedTemplateName} onChange={(event) => setSelectedTemplateName(event.target.value)}>
                  {templateNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </FormField>
              <Button className="min-h-9 justify-self-start px-3 py-1.5 text-xs" disabled={templatesLoading} onClick={loadTemplates} variant="secondary">
                <RefreshCw className={cn('size-3.5', templatesLoading && 'animate-spin')} />
                Refresh templates
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Apply to">
                <select className={inputClass} value={templateTarget} onChange={(event) => setTemplateTarget(event.target.value as TemplateApplyTarget)}>
                  <option value="family">Shared family plan</option>
                  <option value="all">All active members</option>
                  <option value="member">One family member</option>
                </select>
              </FormField>
              <FormField label="Family member" className={templateTarget === 'member' ? '' : 'opacity-60'}>
                <select className={inputClass} disabled={templateTarget !== 'member'} value={templateMemberId} onChange={(event) => setTemplateMemberId(event.target.value)}>
                  {state.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid gap-2">
              <Button onClick={applyTarget} disabled={generating !== null}>
                <ClipboardCheck className="size-4" />
                {generating ? 'Applying...' : 'Apply template'}
              </Button>
              <Button className="min-h-9 px-3 py-1.5 text-xs" onClick={generateForAll} disabled={generating !== null} variant="secondary">
                <ClipboardCheck className="size-3.5" />
                Generate for all members
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.members.map((m) => {
              const count = memberMealCount(m.id)
              const isSelected = selectedMemberId === m.id
              return (
                <div
                  className={cn(
                    'flex items-center justify-between rounded-xl border p-4 transition-all cursor-pointer',
                    isSelected ? 'border-indigo-300 bg-indigo-50/50 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm',
                  )}
                  key={m.id}
                  onClick={() => setSelectedMemberId(isSelected ? null : m.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('flex size-9 items-center justify-center rounded-full text-sm font-bold text-white', m.colorClass)}>{m.initial}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500">{count > 0 ? `${count} meals this week` : 'No plan yet'}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); generateForMember(m.id) }}
                    disabled={generating !== null}
                    title={`Generate plan for ${m.name}`}
                  >
                    {generating === m.id ? <RefreshCw className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected member's meal grid */}
      {selectedMemberId !== null && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{state.members.find((m) => m.id === selectedMemberId)?.name}'s Meal Plan</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {memberMealsLoading ? 'Loading...' : `${activeMeals.length} meals · Click any cell to customize`}
              </p>
            </div>
            <Badge tone="indigo">{activeMeals.length} meals</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[700px] p-5">
                {/* Header row */}
                <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 mb-2">
                  <div />
                  {mealTypes.map((mt) => (
                    <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400" key={mt}>{mt}</div>
                  ))}
                </div>
                {/* Day rows */}
                {dayOrder.map((day) => (
                  <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 mb-2" key={day}>
                    <div className="flex items-center text-xs font-bold uppercase text-slate-500">{day.slice(0, 3)}</div>
                    {mealTypes.map((mt) => {
                      const meal = mealsByDay[day]?.find((m) => m.mealType === mt)
                      if (!meal) {
                        return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-300" key={`${day}-${mt}`}>—</div>
                      }
                      const isEditing = editingMealId === meal.id
                      return (
                        <div
                          className={cn('rounded-xl border p-3 transition-all', isEditing ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm cursor-pointer')}
                          key={`${day}-${mt}`}
                          onClick={() => { if (!isEditing) { setEditingMealId(meal.id); setEditName(meal.mealName) } }}
                        >
                          {isEditing ? (
                            <div className="grid gap-2">
                              <input
                                className={cn(inputClass, 'text-xs py-1.5 px-2')}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMeal(meal.id); if (e.key === 'Escape') setEditingMealId(null) }}
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <button className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white" onClick={() => handleSaveMeal(meal.id)} type="button">Save</button>
                                <button className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600" onClick={() => setEditingMealId(null)} type="button">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-slate-800 line-clamp-2">{meal.mealName}</p>
                              <p className="mt-1 text-[10px] text-slate-400">{meal.calories} cal · {meal.prepTime}m</p>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ─── Security Panel ─── */
const SecurityPanel = ({ store: _store }: Props) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [devicePolicy, setDevicePolicy] = useState<DevicePolicy | null>(null)
  const [deviceLimitDraft, setDeviceLimitDraft] = useState(5)
  const [registrationQr, setRegistrationQr] = useState('')
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [invites, setInvites] = useState<SignupInvite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member',
    expiresInDays: 7,
    maxUses: 1,
  })
  const [latestInviteLink, setLatestInviteLink] = useState('')
  const [latestInviteQr, setLatestInviteQr] = useState('')

  const loadDevices = useCallback(() => {
    setDevicesLoading(true)
    Promise.all([api.listDevices(), api.getDevicePolicy()])
      .then(([deviceRows, policy]) => {
        setDevices(deviceRows)
        setDevicePolicy(policy)
        setDeviceLimitDraft(policy.maxDevices)
      })
      .catch(() => {})
      .finally(() => setDevicesLoading(false))
  }, [])

  const loadInvites = useCallback(() => {
    setInvitesLoading(true)
    api.listSignupInvites().then(setInvites).catch(() => {}).finally(() => setInvitesLoading(false))
  }, [])

  useEffect(() => { loadDevices(); loadInvites() }, [loadDevices, loadInvites])

  useEffect(() => {
    const link = `${window.location.origin}/`
    QRCode.toDataURL(link, { margin: 1, width: 180 }).then(setRegistrationQr).catch(() => {})
  }, [])

  const inviteLinkFromToken = (token: string) => `${window.location.origin}/?invite=${encodeURIComponent(token)}`

  const handleCreateInvite = () => {
    const allowedRoles = new Set(['member', 'child', 'parent', 'admin'])
    const email = inviteForm.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ type: 'error', message: 'Enter a valid invite email or leave it blank for an open invite' })
      return
    }
    if (!allowedRoles.has(inviteForm.role)) {
      setStatus({ type: 'error', message: 'Choose a valid invite role' })
      return
    }
    if (inviteForm.expiresInDays < 1 || inviteForm.expiresInDays > 30 || inviteForm.maxUses < 1 || inviteForm.maxUses > 10) {
      setStatus({ type: 'error', message: 'Invite expiry must be 1-30 days and uses must be 1-10' })
      return
    }
    setInvitesLoading(true)
    setStatus(null)
    setLatestInviteLink('')
    setLatestInviteQr('')
    api
      .createSignupInvite({
        email: email || undefined,
        role: inviteForm.role,
        expiresInDays: inviteForm.expiresInDays,
        maxUses: inviteForm.maxUses,
      })
      .then(async (invite) => {
        await loadInvites()
        if (invite.inviteToken) {
          const link = inviteLinkFromToken(invite.inviteToken)
          setLatestInviteLink(link)
          setLatestInviteQr(await QRCode.toDataURL(link, { margin: 1, width: 180 }))
        }
        setStatus({ type: 'success', message: `${invite.role} invite created${invite.email ? ` for ${invite.email}` : ''}` })
        setInviteForm((current) => ({ ...current, email: '' }))
      })
      .catch((err: unknown) => setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create invite' }))
      .finally(() => setInvitesLoading(false))
  }

  const handleRevokeInvite = (inviteId: number) => {
    api
      .revokeSignupInvite(inviteId)
      .then(() => {
        setStatus({ type: 'success', message: 'Invite revoked' })
        loadInvites()
      })
      .catch((err: unknown) => setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to revoke invite' }))
  }

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirm) {
      setStatus({ type: 'error', message: 'New passwords do not match' })
      return
    }
    if (newPassword.length < 8) {
      setStatus({ type: 'error', message: 'Password must be at least 8 characters' })
      return
    }
    setLoading(true)
    api
      .changePassword(currentPassword, newPassword)
      .then(() => {
        setStatus({ type: 'success', message: 'Password changed successfully' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirm('')
      })
      .catch((err: unknown) => {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to change password' })
      })
      .finally(() => setLoading(false))
  }

  const handleRevokeDevice = (deviceId: number) => {
    api
      .revokeDevice(deviceId)
      .then(() => {
        setStatus({ type: 'success', message: 'Device revoked' })
        loadDevices()
      })
      .catch((err: unknown) => setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to revoke device' }))
  }

  const handleToggleTrust = (deviceId: number, isTrusted: boolean) => {
    api
      .updateDevice(deviceId, { isTrusted: !isTrusted })
      .then(() => {
        setStatus({ type: 'success', message: isTrusted ? 'Device trust removed' : 'Device marked trusted' })
        loadDevices()
      })
      .catch((err: unknown) => setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update device trust' }))
  }

  const handleUpdateDeviceLimit = () => {
    if (deviceLimitDraft < Math.max(1, devicePolicy?.activeDeviceCount ?? 1) || deviceLimitDraft > 20) {
      setStatus({ type: 'error', message: 'Device limit must be at least the active device count and no more than 20' })
      return
    }
    api
      .updateDevicePolicy(deviceLimitDraft)
      .then((policy) => {
        setDevicePolicy(policy)
        setDeviceLimitDraft(policy.maxDevices)
        setStatus({ type: 'success', message: 'Device limit updated' })
      })
      .catch((err: unknown) => setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update device limit' }))
  }

  const ToggleIcon = showPassword ? EyeOff : Eye

  return (
    <div className="grid gap-5">
      {status && (
        <div className={cn('rounded-xl border px-4 py-3 text-sm font-medium', status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800')}>
          {status.message}
        </div>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 max-w-md">
          <FormField label="Current Password">
            <div className="relative">
              <input className={inputClass} type={showPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)} type="button">
                <ToggleIcon className="size-4" />
              </button>
            </div>
          </FormField>
          <FormField label="New Password">
            <input className={inputClass} type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </FormField>
          <FormField label="Confirm New Password">
            <input className={inputClass} type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </FormField>
          <Button onClick={handleChangePassword} disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>

      {/* Signup Invites */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Signup Invites</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Create short-lived invite links that require device registration during signup</p>
          </div>
          <Button aria-label="Refresh signup invites" variant="outline" onClick={loadInvites} disabled={invitesLoading}>
            <RefreshCw className={cn('size-4', invitesLoading && 'animate-spin')} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_140px_120px_120px_auto]">
            <FormField label="Email">
              <input
                className={inputClass}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Optional"
                type="email"
                value={inviteForm.email}
              />
            </FormField>
            <FormField label="Role">
              <select
                className={inputClass}
                onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                value={inviteForm.role}
              >
                <option value="member">Member</option>
                <option value="child">Child</option>
                <option value="parent">Parent</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            <FormField label="Days">
              <input
                className={inputClass}
                max={30}
                min={1}
                onChange={(event) => setInviteForm((current) => ({ ...current, expiresInDays: Number(event.target.value) }))}
                type="number"
                value={inviteForm.expiresInDays}
              />
            </FormField>
            <FormField label="Uses">
              <input
                className={inputClass}
                max={10}
                min={1}
                onChange={(event) => setInviteForm((current) => ({ ...current, maxUses: Number(event.target.value) }))}
                type="number"
                value={inviteForm.maxUses}
              />
            </FormField>
            <div className="flex items-end">
              <Button className="w-full" onClick={handleCreateInvite} disabled={invitesLoading}>
                <Plus className="size-4" />
                Create
              </Button>
            </div>
          </div>

          {latestInviteLink && (
            <div className="grid gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 md:grid-cols-[190px_1fr]">
              <div className="flex items-center justify-center rounded-xl bg-white p-3">
                {latestInviteQr ? (
                  <img alt="Signup invite QR code" className="size-[180px]" src={latestInviteQr} />
                ) : (
                  <QrCode className="size-16 text-indigo-200" />
                )}
              </div>
              <div className="grid content-center gap-3">
                <p className="text-sm font-semibold text-slate-900">Invite link ready</p>
                <input className={inputClass} readOnly value={latestInviteLink} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigator.clipboard?.writeText(latestInviteLink)} variant="secondary">
                    <Copy className="size-4" />
                    Copy link
                  </Button>
                  <Button onClick={() => window.open(latestInviteLink, '_blank', 'noopener,noreferrer')} variant="outline">
                    <QrCode className="size-4" />
                    Open
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="px-4 py-3">Invite</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={5}>
                      No signup invites have been created.
                    </td>
                  </tr>
                ) : (
                  invites.map((invite) => {
                    const isExpired = !invite.isActive
                    return (
                    <tr className={cn('border-t border-slate-100', isExpired ? 'bg-slate-50/60' : 'bg-white')} key={invite.id}>
                      <td className={cn('px-4 py-3 text-sm', isExpired ? 'text-slate-400' : 'text-slate-700')}>{invite.email || 'Open invite'}</td>
                      <td className="px-4 py-3"><Badge tone={isExpired ? 'slate' : 'indigo'}>{invite.role}</Badge></td>
                      <td className={cn('px-4 py-3 text-sm', isExpired ? 'text-slate-400' : 'text-slate-600')}>{invite.usedCount} / {invite.maxUses}</td>
                      <td className="px-4 py-3 text-sm">
                        {isExpired ? (
                          <span className="text-slate-400">{new Date(invite.expiresAt).toLocaleDateString()}</span>
                        ) : (
                          <span className={new Date(invite.expiresAt) < new Date(Date.now() + 86400000) ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {invite.isActive ? (
                          <Button className="min-h-9 px-3 py-1.5 text-xs" onClick={() => handleRevokeInvite(invite.id)} variant="danger">
                            Revoke
                          </Button>
                        ) : (
                          <Badge tone="slate">{invite.usedCount >= invite.maxUses ? 'Used' : 'Expired'}</Badge>
                        )}
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device Registration</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Use this panel to add another phone, tablet, or desktop for this account.</p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="grid place-items-center rounded-xl border border-slate-100 bg-slate-50 p-4">
            {registrationQr ? (
              <img alt="Device registration QR code" className="size-36 rounded-lg bg-white p-2" src={registrationQr} />
            ) : (
              <QrCode className="size-12 text-slate-300" />
            )}
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <FormField label="Max devices">
                <input
                  className={inputClass}
                  max={20}
                  min={Math.max(1, devicePolicy?.activeDeviceCount ?? 1)}
                  onChange={(event) => setDeviceLimitDraft(Number(event.target.value))}
                  type="number"
                  value={deviceLimitDraft}
                />
              </FormField>
              <Button onClick={handleUpdateDeviceLimit} variant="secondary">
                Save limit
              </Button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                {devicePolicy?.activeDeviceCount ?? devices.length} of {devicePolicy?.maxDevices ?? deviceLimitDraft} devices registered
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Open FamilyHub on another device or scan this QR code, then sign in with the same account. The device is registered automatically after sign-in.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/`)} variant="secondary">
                  <Copy className="size-4" />
                  Copy sign-in link
                </Button>
                <Button onClick={() => window.open(`${window.location.origin}/`, '_blank', 'noopener,noreferrer')} variant="outline">
                  <QrCode className="size-4" />
                  Open
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registered Devices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registered Devices</CardTitle>
          <Button aria-label="Refresh registered devices" variant="outline" onClick={loadDevices} disabled={devicesLoading}>
            <RefreshCw className={cn('size-4', devicesLoading && 'animate-spin')} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {devices.length === 0 && !devicesLoading && <p className="py-6 text-center text-sm text-slate-400">No devices registered</p>}
          {devices.map((d) => (
            <div className={cn('flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm', d.isRevoked ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-white')} key={d.id}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{d.deviceName}</p>
                  {d.isTrusted && <Badge tone="green">Trusted</Badge>}
                  {d.isRevoked && <Badge tone="rose">Revoked</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{d.deviceType} · {d.ipAddress || 'Unknown IP'} · Last used {new Date(d.lastUsedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1">
                {!d.isRevoked && (
                  <>
                    <Button variant="icon" iconOnly onClick={() => handleToggleTrust(d.id, d.isTrusted)} title={d.isTrusted ? 'Remove trust' : 'Mark trusted'}>
                      <Key className={cn('size-3.5', d.isTrusted ? 'text-emerald-500' : 'text-slate-400')} />
                    </Button>
                    <Button variant="icon" iconOnly onClick={() => handleRevokeDevice(d.id)} title="Revoke device">
                      <Trash2 className="size-3.5 text-rose-500" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
