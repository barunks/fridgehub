import { useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  GripVertical,
  Home,
  LayoutGrid,
  Play,
  ShoppingBasket,
  Users,
} from 'lucide-react'
import { cn } from '@/utils/style'

interface ModuleGuide {
  id: string
  title: string
  icon: typeof Home
  gradient: string
  shadow: string
  tagline: string
  workflow: { step: string; detail: string }[]
  tips: string[]
  mockup: React.ReactNode
}

/* Mini visual mockups for each module */
const DashboardMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 grid grid-cols-3 gap-1.5">
      {[{ n: '4', l: 'Tasks', c: 'bg-indigo-500' }, { n: '3', l: 'Purchases', c: 'bg-amber-500' }, { n: '5', l: 'Members', c: 'bg-emerald-500' }].map((s) => (
        <div key={s.l} className="rounded-lg bg-white p-2 text-center shadow-sm">
          <div className={`mx-auto mb-1 size-5 rounded-full ${s.c} flex items-center justify-center text-[9px] font-bold text-white`}>{s.n}</div>
          <div className="text-[8px] text-slate-500">{s.l}</div>
        </div>
      ))}
    </div>
    <div className="space-y-1">
      <div className="h-2 w-full rounded bg-indigo-100" />
      <div className="h-2 w-3/4 rounded bg-emerald-100" />
      <div className="h-2 w-5/6 rounded bg-amber-100" />
    </div>
  </div>
)

const TasksMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="grid grid-cols-3 gap-1.5">
      {['Pending', 'Active', 'Done'].map((col, ci) => (
        <div key={col} className="rounded-lg bg-white p-1.5 shadow-sm">
          <div className="mb-1.5 text-center text-[8px] font-bold text-slate-400">{col}</div>
          {[0, 1].map((i) => (
            <div key={i} className={cn('mb-1 flex items-center gap-1 rounded-md border p-1.5', ci === 2 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100')}>
              <GripVertical className="size-2.5 text-slate-300" />
              <div className={cn('h-1.5 rounded-full', ci === 0 ? 'w-full bg-rose-200' : ci === 1 ? 'w-3/4 bg-amber-200' : 'w-2/3 bg-emerald-200')} />
              {ci === 2 && <Check className="size-2.5 text-emerald-500" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
)

const GroceryMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 flex gap-1">
      {['Wet Mkt', 'Super', 'NTUC'].map((s, i) => (
        <div key={s} className={cn('rounded-md px-2 py-0.5 text-[8px] font-bold', i === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500')}>{s}</div>
      ))}
    </div>
    {['Spinach · 500g', 'Tomato · 1kg', 'Fish · 2pcs'].map((item, i) => (
      <div key={item} className="mb-1 flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2 py-1.5 shadow-sm">
        <div className={cn('size-3 rounded border-2', i === 1 ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300')} />
        <span className="flex-1 text-[9px] text-slate-700">{item}</span>
        <span className={cn('text-[8px] font-medium', i === 1 ? 'text-emerald-600' : 'text-amber-600')}>{i === 1 ? '✓ Stocked' : 'Need'}</span>
      </div>
    ))}
  </div>
)

const MealsMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 flex items-center justify-between">
      <div className="text-[9px] font-bold text-slate-500">This Week</div>
      <div className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[8px] font-bold text-indigo-700">👤 Meera</div>
    </div>
    <div className="grid grid-cols-7 gap-0.5">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <div key={`${d}-${i}`} className="text-center">
          <div className="mb-0.5 text-[7px] font-bold text-slate-400">{d}</div>
          <div className={cn('h-6 rounded-sm', ['bg-rose-200', 'bg-orange-200', 'bg-yellow-200', 'bg-green-200', 'bg-sky-200', 'bg-blue-200', 'bg-indigo-200'][i])} />
          <div className={cn('mt-0.5 h-4 rounded-sm opacity-60', ['bg-rose-100', 'bg-orange-100', 'bg-yellow-100', 'bg-green-100', 'bg-sky-100', 'bg-blue-100', 'bg-indigo-100'][i])} />
        </div>
      ))}
    </div>
  </div>
)

const FamilyMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="space-y-1.5">
      {[{ name: 'Meera', role: 'Mom', color: 'bg-pink-500' }, { name: 'Dad', role: 'Parent', color: 'bg-blue-500' }, { name: 'Ava', role: 'Child', color: 'bg-emerald-500' }, { name: 'Noah', role: 'Child', color: 'bg-amber-400' }].map((m) => (
        <div key={m.name} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2 py-1.5 shadow-sm">
          <div className={`size-5 rounded-full ${m.color} flex items-center justify-center text-[8px] font-bold text-white`}>{m.name[0]}</div>
          <span className="flex-1 text-[9px] font-medium text-slate-700">{m.name}</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[7px] text-slate-500">{m.role}</span>
        </div>
      ))}
    </div>
  </div>
)

const AnalyticsMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 flex items-end gap-1">
      {[35, 55, 40, 70, 50, 65, 85].map((h, i) => (
        <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-violet-500 to-purple-300" style={{ height: `${h * 0.4}px` }} />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <div className="rounded-md bg-white p-1.5 shadow-sm">
        <div className="text-[8px] text-slate-400">Completion</div>
        <div className="text-[11px] font-bold text-emerald-600">78%</div>
      </div>
      <div className="rounded-md bg-white p-1.5 shadow-sm">
        <div className="text-[8px] text-slate-400">Points</div>
        <div className="text-[11px] font-bold text-violet-600">361</div>
      </div>
    </div>
  </div>
)

const AdminMockup = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 flex gap-1">
      {['Members', 'Meals', 'Security'].map((t, i) => (
        <div key={t} className={cn('rounded-md px-1.5 py-0.5 text-[7px] font-bold', i === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400')}>{t}</div>
      ))}
    </div>
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2 py-1.5 shadow-sm">
          <div className="size-4 rounded-full bg-slate-200" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
          <div className="h-4 w-10 rounded-md bg-indigo-100" />
        </div>
      ))}
    </div>
  </div>
)

const modules: ModuleGuide[] = [
  {
    id: 'dashboard',
    title: 'Home Dashboard',
    icon: Home,
    gradient: 'from-indigo-500 to-blue-600',
    shadow: 'shadow-indigo-500/25',
    tagline: 'Your daily family snapshot — everything important at a glance',
    workflow: [
      { step: 'Open the app', detail: 'Landing page loads with time-aware greeting and family context' },
      { step: 'Review stat cards', detail: 'See reminder count, pending purchases, and active members in real-time' },
      { step: 'Check today\'s tasks', detail: 'Priority-sorted tasks with assignee avatars and countdown timers' },
      { step: 'Glance at meals', detail: 'Today\'s breakfast, lunch, snacks, dinner with calorie totals' },
      { step: 'Read AI insights', detail: 'Proactive suggestions: leave buffers, expiry alerts, meal ideas' },
    ],
    tips: ['Dashboard auto-refreshes from the API', 'Click any card to jump to its full view', 'AI insights update based on real-time data'],
    mockup: <DashboardMockup />,
  },
  {
    id: 'tasks',
    title: 'Tasks & Reminders',
    icon: ClipboardList,
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/25',
    tagline: 'Drag-and-drop task board with recurring schedules and reward points',
    workflow: [
      { step: 'View the board', detail: 'Three columns: Pending → In Progress → Completed with drag support' },
      { step: 'Add a new task', detail: 'Set title, category, priority, due date, recurrence, and assignee' },
      { step: 'Drag to reassign', detail: 'Grab any card and drop on another member — instant backend sync' },
      { step: 'Set recurrence', detail: 'Daily, weekly, or monthly — perfect for medication and chores' },
      { step: 'Complete & earn points', detail: 'Check off tasks to earn reward points on the family leaderboard' },
    ],
    tips: ['Categories: health, school, chore, bill, activity', 'High-priority tasks show red badges', 'Completed tasks remain visible for audit'],
    mockup: <TasksMockup />,
  },
  {
    id: 'groceries',
    title: 'Groceries & Shopping',
    icon: ShoppingBasket,
    gradient: 'from-rose-500 to-pink-600',
    shadow: 'shadow-rose-500/25',
    tagline: 'Multi-store shopping with purchase cycles, stock tracking, and PDF reports',
    workflow: [
      { step: 'Browse by store', detail: 'Wet Market, Super Market, Murugan, NTUC — each with its own list' },
      { step: 'Add items', detail: 'Name, quantity, unit, frequency, notes — auto-numbered (GRC-0001)' },
      { step: 'Track stock', detail: 'Toggle in-stock/out-of-stock — "Needs Purchase" filter for shopping' },
      { step: 'Purchase cycles', detail: 'Auto-generated weekly/monthly cycles with carry-forward logic' },
      { step: 'Download PDF', detail: 'Printable shopping list filtered by store, frequency, or stock' },
      { step: 'Expiry alerts', detail: 'Get notified before perishables expire — use them in meals first' },
    ],
    tips: ['Use "Regenerate Cycles" to reset manually', 'PDF includes FamilyHub watermark', 'Unpurchased items carry forward to next cycle'],
    mockup: <GroceryMockup />,
  },
  {
    id: 'meals',
    title: 'Meal Planning',
    icon: CalendarDays,
    gradient: 'from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/25',
    tagline: 'Per-member weekly plans with templates, recipes, and calorie tracking',
    workflow: [
      { step: 'View weekly grid', detail: '7 days × 4 meals (breakfast, lunch, snacks, dinner) color-coded' },
      { step: 'Switch members', detail: 'Dropdown to view/edit each member\'s individual meal plan' },
      { step: 'Edit a meal', detail: 'Click any cell — change name, calories, prep time, dietary flags' },
      { step: 'Generate from template', detail: 'One click fills a full week from the family master template' },
      { step: 'Link recipes', detail: 'Associate meals with recipes for ingredient and prep planning' },
    ],
    tips: ['Each member can have completely different meals', 'Dietary flags: vegetarian, no-peanuts, etc.', 'Template generation works per-member or family-wide'],
    mockup: <MealsMockup />,
  },
  {
    id: 'family',
    title: 'Family Workspace',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-600',
    shadow: 'shadow-blue-500/25',
    tagline: 'Members, announcements, emergency contacts, and notifications hub',
    workflow: [
      { step: 'View members', detail: 'Roles, status messages, reward points, and color-coded avatars' },
      { step: 'Post announcements', detail: 'Family-wide messages — weekend plans, guest visits, reminders' },
      { step: 'Emergency contacts', detail: 'Always-visible sidebar: Ambulance (995), Police (999), Fire (995)' },
      { step: 'Notifications', detail: 'Bell icon — expiry, task, meal, and system alerts in real-time' },
      { step: 'Mark as read', detail: 'Click to dismiss individually or "Mark all read" for bulk clear' },
    ],
    tips: ['Emergency contacts are always one click away', 'Announcements show on everyone\'s dashboard', 'Notifications are generated from backend events'],
    mockup: <FamilyMockup />,
  },
  {
    id: 'analytics',
    title: 'Household Analytics',
    icon: BarChart3,
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-500/25',
    tagline: 'Visual charts for task flow, pantry coverage, calories, and rewards',
    workflow: [
      { step: 'Task completion chart', detail: 'Bar chart showing completion rates by member and category' },
      { step: 'Pantry coverage', detail: 'Percentage of items in-stock vs. needing purchase across stores' },
      { step: 'Calorie overview', detail: 'Weekly calorie distribution across all meals for nutrition balance' },
      { step: 'Reward leaderboard', detail: 'Points earned per member — motivates the whole family' },
    ],
    tips: ['Charts are lazy-loaded for performance', 'Data updates in real-time from other modules', 'Great for weekly family review meetings'],
    mockup: <AnalyticsMockup />,
  },
  {
    id: 'command-center',
    title: 'Command Center',
    icon: LayoutGrid,
    gradient: 'from-slate-700 to-slate-900',
    shadow: 'shadow-slate-500/25',
    tagline: 'Parent-only admin — unified CRUD for all family data and security',
    workflow: [
      { step: 'Members tab', detail: 'Create, edit roles/names/colors, delete with confirmation prompts' },
      { step: 'Meal Plans tab', detail: 'Generate per-member plans from template, inline meal editing' },
      { step: 'Recipes tab', detail: 'Full library with real-time search, create, and delete' },
      { step: 'Tasks tab', detail: 'Filter by status, toggle completion, delete across all members' },
      { step: 'Grocery Places tab', detail: 'Manage stores, regenerate purchase cycles on demand' },
      { step: 'Security tab', detail: 'Password change, device management, invite links + QR codes' },
    ],
    tips: ['Only parents/admins can access this', 'Device revocation blocks all sessions instantly', 'Invite links expire and have configurable usage limits'],
    mockup: <AdminMockup />,
  },
]

export const DemoModules = () => {
  const [activeModule, setActiveModule] = useState('dashboard')
  const [activeStep, setActiveStep] = useState(0)
  const current = modules.find((m) => m.id === activeModule) ?? modules[0]
  const Icon = current.icon

  const handleModuleChange = (id: string) => {
    setActiveModule(id)
    setActiveStep(0)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Module selector */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Module</p>
        <nav className="grid gap-1">
          {modules.map((mod) => {
            const ModIcon = mod.icon
            const active = mod.id === activeModule
            return (
              <button
                key={mod.id}
                onClick={() => handleModuleChange(mod.id)}
                type="button"
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                  active
                    ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <div className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-all',
                  active ? 'bg-white/15' : 'bg-slate-100 group-hover:bg-slate-200',
                )}>
                  <ModIcon className={cn('size-4', active ? 'text-white' : 'text-slate-500')} aria-hidden="true" />
                </div>
                <span className="text-sm font-medium">{mod.title}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Module detail */}
      <div className="grid gap-5" key={activeModule}>
        {/* Header with mockup */}
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          <div className={cn('bg-gradient-to-r p-6 text-white', current.gradient)}>
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{current.title}</h3>
                <p className="mt-0.5 text-sm text-white/80">{current.tagline}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            {current.mockup}
          </div>
        </div>

        {/* Interactive workflow steps */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Play className="size-4 text-indigo-500" aria-hidden="true" />
              Workflow Steps
            </h4>
            <span className="text-xs text-slate-400">{activeStep + 1} of {current.workflow.length}</span>
          </div>

          {/* Step progress bar */}
          <div className="mb-5 flex gap-1">
            {current.workflow.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                type="button"
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all',
                  idx <= activeStep ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-slate-100',
                )}
              />
            ))}
          </div>

          {/* Steps list */}
          <div className="grid gap-2">
            {current.workflow.map((item, idx) => (
              <button
                key={item.step}
                onClick={() => setActiveStep(idx)}
                type="button"
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                  idx === activeStep
                    ? 'border-indigo-200 bg-indigo-50/50 shadow-sm'
                    : idx < activeStep
                      ? 'border-emerald-100 bg-emerald-50/30'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50',
                )}
              >
                <div className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  idx === activeStep
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md'
                    : idx < activeStep
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400',
                )}>
                  {idx < activeStep ? <Check className="size-3.5" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold', idx === activeStep ? 'text-indigo-900' : 'text-slate-700')}>{item.step}</p>
                  {idx === activeStep && (
                    <p className="mt-1 animate-fade-in-up text-xs leading-relaxed text-slate-600">{item.detail}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/30 p-5 shadow-sm">
          <h4 className="mb-3 text-sm font-bold text-amber-800">💡 Pro Tips</h4>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {current.tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 text-xs text-slate-700 shadow-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
