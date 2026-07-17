import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Home,
  LayoutGrid,
  Lock,
  RefreshCw,
  ShoppingBasket,
  Zap,
} from 'lucide-react'
import { cn } from '@/utils/style'

interface FlowStage {
  icon: typeof Home
  label: string
  description: string
  gradient: string
  preview: { label: string; value: string }[]
}

const stages: FlowStage[] = [
  {
    icon: Lock,
    label: 'Authenticate',
    description: 'Secure login with device registration. Every session is tied to a physical device.',
    gradient: 'from-slate-600 to-slate-800',
    preview: [
      { label: 'Method', value: 'JWT + HttpOnly cookies' },
      { label: 'Device', value: 'Auto-registered on login' },
      { label: 'Rate limit', value: '10 attempts/minute' },
    ],
  },
  {
    icon: Home,
    label: 'Dashboard',
    description: 'Your daily command center — tasks, meals, groceries, and AI insights at a glance.',
    gradient: 'from-indigo-500 to-blue-600',
    preview: [
      { label: 'Stat cards', value: 'Tasks · Purchases · Members' },
      { label: 'Today view', value: 'Agenda + meal preview' },
      { label: 'AI panel', value: 'Proactive suggestions' },
    ],
  },
  {
    icon: ClipboardList,
    label: 'Manage Tasks',
    description: 'Create reminders, assign to members, drag to reassign, earn reward points.',
    gradient: 'from-emerald-500 to-teal-600',
    preview: [
      { label: 'Board', value: 'Pending → Active → Done' },
      { label: 'Assign', value: 'Drag-and-drop between members' },
      { label: 'Recurrence', value: 'Daily / Weekly / Monthly' },
    ],
  },
  {
    icon: ShoppingBasket,
    label: 'Shop Groceries',
    description: 'Multi-store lists with purchase cycles, stock tracking, and PDF export.',
    gradient: 'from-rose-500 to-pink-600',
    preview: [
      { label: 'Stores', value: '4 shopping places' },
      { label: 'Cycles', value: 'Auto-generated per frequency' },
      { label: 'Export', value: 'Printable PDF report' },
    ],
  },
  {
    icon: CalendarDays,
    label: 'Plan Meals',
    description: 'Per-member weekly plans with templates, recipes, and calorie tracking.',
    gradient: 'from-amber-500 to-orange-600',
    preview: [
      { label: 'Grid', value: '7 days × 4 meal types' },
      { label: 'Members', value: 'Individual plans per person' },
      { label: 'Templates', value: 'One-click generation' },
    ],
  },
  {
    icon: BarChart3,
    label: 'Track Analytics',
    description: 'Visual charts for task flow, pantry coverage, calories, and reward points.',
    gradient: 'from-violet-500 to-purple-600',
    preview: [
      { label: 'Tasks', value: 'Completion by member' },
      { label: 'Pantry', value: 'Stock coverage %' },
      { label: 'Points', value: 'Family leaderboard' },
    ],
  },
]

const connections = [
  { from: 'Tasks', to: 'Dashboard', desc: 'Today\'s agenda feeds from active tasks', color: 'from-emerald-400 to-indigo-400' },
  { from: 'Groceries', to: 'AI Assistant', desc: 'Expiry dates trigger smart alerts', color: 'from-rose-400 to-teal-400' },
  { from: 'Meals', to: 'Groceries', desc: 'Recipes generate ingredient needs', color: 'from-amber-400 to-rose-400' },
  { from: 'Tasks', to: 'Analytics', desc: 'Completions update reward points', color: 'from-emerald-400 to-violet-400' },
  { from: 'All Modules', to: 'Notifications', desc: 'Events trigger real-time alerts', color: 'from-indigo-400 to-pink-400' },
]

export const DemoWorkflow = () => {
  const [activeStage, setActiveStage] = useState(1)
  const current = stages[activeStage]
  const Icon = current.icon

  return (
    <div className="grid gap-8">
      {/* Interactive timeline */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-slate-900">Application Flow</h3>
          <p className="mt-1 text-sm text-slate-500">Click each stage to explore how FridgeHub works end-to-end</p>
        </div>

        {/* Timeline bar */}
        <div className="relative mb-8">
          {/* Progress track */}
          <div className="absolute left-0 top-5 h-1 w-full rounded-full bg-slate-100" />
          <div
            className="absolute left-0 top-5 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${(activeStage / (stages.length - 1)) * 100}%` }}
          />

          {/* Stage dots */}
          <div className="relative flex justify-between">
            {stages.map((stage, idx) => {
              const StageIcon = stage.icon
              const isActive = idx === activeStage
              const isPast = idx < activeStage
              return (
                <button
                  key={stage.label}
                  onClick={() => setActiveStage(idx)}
                  type="button"
                  className="group flex flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                      isActive
                        ? 'scale-125 border-indigo-500 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                        : isPast
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                          : 'border-slate-200 bg-white text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-500',
                    )}
                  >
                    <StageIcon className="size-4" aria-hidden="true" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold transition-colors hidden sm:block',
                    isActive ? 'text-indigo-700' : 'text-slate-400',
                  )}>
                    {stage.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Active stage detail */}
        <div className="animate-fade-in-up rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-6" key={activeStage}>
          <div className="flex items-start gap-4">
            <div className={cn('flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl', current.gradient)}>
              <Icon className="size-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-slate-900">{current.label}</h4>
              <p className="mt-1 text-sm text-slate-600">{current.description}</p>
            </div>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
              Step {activeStage + 1}/{stages.length}
            </span>
          </div>

          {/* Preview data */}
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {current.preview.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Navigation arrows */}
          <div className="mt-5 flex items-center justify-between">
            <button
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
              disabled={activeStage === 0}
              onClick={() => setActiveStage((s) => s - 1)}
              type="button"
            >
              ← Previous
            </button>
            <div className="flex gap-1">
              {stages.map((_, i) => (
                <div key={i} className={cn('size-1.5 rounded-full transition-all', i === activeStage ? 'w-4 bg-indigo-500' : 'bg-slate-200')} />
              ))}
            </div>
            <button
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
              disabled={activeStage === stages.length - 1}
              onClick={() => setActiveStage((s) => s + 1)}
              type="button"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Data flow connections - visual */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
            <RefreshCw className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Smart Data Flow</h3>
            <p className="text-sm text-slate-500">Modules communicate automatically — no manual syncing</p>
          </div>
        </div>

        <div className="grid gap-3">
          {connections.map((conn) => (
            <div key={`${conn.from}-${conn.to}`} className="group rounded-2xl border border-slate-100 p-4 transition-all hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-center gap-4">
                {/* From */}
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Zap className="size-3.5 text-slate-500" aria-hidden="true" />
                  <span className="text-xs font-bold text-slate-700">{conn.from}</span>
                </div>

                {/* Animated connector */}
                <div className="flex flex-1 items-center gap-1">
                  <div className={cn('h-0.5 flex-1 rounded-full bg-gradient-to-r opacity-40 transition-opacity group-hover:opacity-100', conn.color)} />
                  <ArrowRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500" aria-hidden="true" />
                </div>

                {/* To */}
                <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2">
                  <Bell className="size-3.5 text-indigo-500" aria-hidden="true" />
                  <span className="text-xs font-bold text-indigo-700">{conn.to}</span>
                </div>
              </div>
              <p className="mt-2.5 pl-1 text-xs text-slate-500">{conn.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities showcase */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: LayoutGrid, title: 'Unified Admin', desc: 'One Command Center for all CRUD', gradient: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20' },
          { icon: Bell, title: 'Smart Alerts', desc: 'Proactive expiry & task notifications', gradient: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/20' },
          { icon: CheckCircle2, title: 'Role Access', desc: 'Parents manage, children view', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
          { icon: Bot, title: 'AI Insights', desc: 'Context-aware recommendations', gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
        ].map((feat) => {
          const FeatIcon = feat.icon
          return (
            <div key={feat.title} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all hover:-translate-y-2 hover:shadow-xl">
              <div className={cn('mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-110', feat.gradient, feat.shadow)}>
                <FeatIcon className="size-5" aria-hidden="true" />
              </div>
              <p className="font-bold text-slate-900">{feat.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{feat.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
