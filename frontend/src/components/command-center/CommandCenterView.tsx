import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  Eye,
  EyeOff,
  Key,
  Pencil,
  Phone,
  Plus,
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
import type { AssistantInsight, DeviceInfo, MealPlanItem, MealType } from '@/types/familyHub'
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

export const CommandCenterView = ({ store }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('members')

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Household Command Center</h1>
          <p className="text-xs text-slate-500">Manage all family resources in one place</p>
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
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role: 'child', colorClass: 'bg-blue-500' })

  const handleSubmit = () => {
    if (!form.name.trim()) return
    if (editId) {
      updateMember(editId, { name: form.name, role: form.role, colorClass: form.colorClass })
    } else {
      addMember(form)
    }
    setShowForm(false)
    setEditId(null)
    setForm({ name: '', email: '', username: '', password: '', role: 'child', colorClass: 'bg-blue-500' })
  }

  const startEdit = (id: number) => {
    const m = state.members.find((x) => x.id === id)
    if (!m) return
    setForm({ name: m.name, email: '', username: '', password: '', role: m.role, colorClass: m.colorClass })
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
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
              {!editId && <FormField label="Username"><input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></FormField>}
              {!editId && <FormField label="Email"><input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>}
              {!editId && <FormField label="Password"><input className={inputClass} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></FormField>}
              <FormField label="Role">
                <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
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
  const { state, addRecipe, deleteRecipe } = store
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ recipeName: '', description: '', cuisine: '', difficulty: 'easy' as 'easy' | 'medium' | 'hard' })
  const [filter, setFilter] = useState('')

  const filtered = filter
    ? state.recipes.filter((r) => r.recipeName.toLowerCase().includes(filter.toLowerCase()) || r.cuisine.toLowerCase().includes(filter.toLowerCase()))
    : state.recipes

  const handleSubmit = () => {
    if (!form.recipeName.trim()) return
    addRecipe({ recipeName: form.recipeName, description: form.description, cuisine: form.cuisine, difficulty: form.difficulty })
    setShowForm(false)
    setForm({ recipeName: '', description: '', cuisine: '', difficulty: 'easy' })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Recipes ({state.recipes.length})</CardTitle>
        <div className="flex gap-2">
          <input className={cn(inputClass, 'max-w-48')} placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button variant="outline" onClick={() => setShowForm(!showForm)}>
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
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={handleSubmit}>Create</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
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
            <Button variant="icon" iconOnly onClick={() => deleteRecipe(r.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No recipes found</p>}
      </CardContent>
    </Card>
  )
}

/* ─── Tasks Panel ─── */
const TasksPanel = ({ store }: Props) => {
  const { state, deleteTask, toggleTaskStatus } = store
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? state.tasks : state.tasks.filter((t) => t.status === filter)
  const ownerName = (assignedTo: number) => state.members.find((m) => m.id === assignedTo)?.name ?? '—'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Tasks ({state.tasks.length})</CardTitle>
        <select className={cn(inputClass, 'max-w-40')} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </CardHeader>
      <CardContent className="grid gap-2 max-h-[500px] overflow-y-auto">
        {filtered.map((t) => (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm" key={t.id}>
            <div className="flex items-center gap-3 min-w-0">
              <input type="checkbox" checked={t.status === 'completed'} onChange={() => toggleTaskStatus(t.id)} className="size-4 accent-indigo-600" />
              <div className="min-w-0">
                <p className={cn('truncate text-sm font-semibold', t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900')}>{t.title}</p>
                <p className="text-xs text-slate-500">{ownerName(t.assignedTo)} · {t.priority}</p>
              </div>
            </div>
            <Button variant="icon" iconOnly onClick={() => deleteTask(t.id)} title="Delete"><Trash2 className="size-3.5 text-rose-500" /></Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No tasks match filter</p>}
      </CardContent>
    </Card>
  )
}

/* ─── Insights Panel ─── */
const InsightsPanel = ({ store }: Props) => {
  const [insights, setInsights] = useState<AssistantInsight[]>(store.state.assistantInsights)
  const [loading, setLoading] = useState(false)

  const fetchInsights = useCallback(() => {
    setLoading(true)
    api
      .getAssistantInsights()
      .then(setInsights)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchInsights() }, [fetchInsights])

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

const MealPlansPanel = ({ store }: Props) => {
  const { state, applyWeeklyTemplate, applyWeeklyTemplateForAll, loadMemberMeals, memberMeals, memberMealsLoading, updateMeal } = store
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [generating, setGenerating] = useState<number | 'all' | null>(null)
  const [editingMealId, setEditingMealId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (selectedMemberId !== null) loadMemberMeals(selectedMemberId)
  }, [selectedMemberId, loadMemberMeals])

  const activeMeals: MealPlanItem[] = selectedMemberId !== null && memberMeals ? memberMeals : state.meals
  const mealsByDay = useMemo(() => {
    return activeMeals.reduce<Record<string, MealPlanItem[]>>((acc, meal) => {
      acc[meal.dayOfWeek] = [...(acc[meal.dayOfWeek] ?? []), meal]
      return acc
    }, {})
  }, [activeMeals])

  const generateForMember = async (memberId: number) => {
    setGenerating(memberId)
    await applyWeeklyTemplate(memberId)
    if (selectedMemberId === memberId) {
      loadMemberMeals(memberId)
    }
    setGenerating(null)
  }

  const generateForAll = async () => {
    setGenerating('all')
    await applyWeeklyTemplateForAll()
    if (selectedMemberId !== null) loadMemberMeals(selectedMemberId)
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
      {/* Header with bulk action */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Per-Member Meal Plans</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Generate from family template, then customize per individual</p>
          </div>
          <Button onClick={generateForAll} disabled={generating !== null}>
            <ClipboardCheck className="size-4" />
            {generating === 'all' ? 'Generating...' : 'Generate for all members'}
          </Button>
        </CardHeader>
        <CardContent>
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
  const [devicesLoading, setDevicesLoading] = useState(false)

  const loadDevices = useCallback(() => {
    setDevicesLoading(true)
    api.listDevices().then(setDevices).catch(() => {}).finally(() => setDevicesLoading(false))
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

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
    api.revokeDevice(deviceId).then(loadDevices).catch(() => {})
  }

  const handleToggleTrust = (deviceId: number, isTrusted: boolean) => {
    api.updateDevice(deviceId, { isTrusted: !isTrusted }).then(loadDevices).catch(() => {})
  }

  const ToggleIcon = showPassword ? EyeOff : Eye

  return (
    <div className="grid gap-5">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 max-w-md">
          {status && (
            <div className={cn('rounded-xl border px-4 py-3 text-sm font-medium', status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800')}>
              {status.message}
            </div>
          )}
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

      {/* Registered Devices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registered Devices</CardTitle>
          <Button variant="outline" onClick={loadDevices} disabled={devicesLoading}>
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
