import {
  CalendarDays,
  ClipboardList,
  Command,
  LayoutGrid,
  Moon,
  Search,
  ShoppingBasket,
  Users,
} from 'lucide-react'
import { cn } from '@/utils/style'

interface HowToItem {
  action: string
  steps: string[]
  icon: typeof Search
  color: string
  iconBg: string
}

interface HowToCategory {
  title: string
  description: string
  items: HowToItem[]
}

const categories: HowToCategory[] = [
  {
    title: 'Tasks & Reminders',
    description: 'Create, assign, and track family tasks',
    items: [
      {
        action: 'Add a new task',
        steps: ['Go to Tasks page', 'Click "Add Task"', 'Fill title, category, priority', 'Set due date & assignee', 'Save'],
        icon: ClipboardList,
        color: 'border-l-emerald-500',
        iconBg: 'bg-emerald-50 text-emerald-600',
      },
      {
        action: 'Reassign a task',
        steps: ['Go to Tasks page', 'Find the task card', 'Drag it to another member column', 'Release — auto-syncs'],
        icon: ClipboardList,
        color: 'border-l-emerald-500',
        iconBg: 'bg-emerald-50 text-emerald-600',
      },
      {
        action: 'Set a recurring reminder',
        steps: ['Add or edit a task', 'Set recurrence: daily/weekly/monthly', 'Save — it auto-repeats'],
        icon: ClipboardList,
        color: 'border-l-emerald-500',
        iconBg: 'bg-emerald-50 text-emerald-600',
      },
    ],
  },
  {
    title: 'Groceries & Shopping',
    description: 'Manage multi-store shopping lists',
    items: [
      {
        action: 'Add a grocery item',
        steps: ['Go to Groceries', 'Click "Add Item"', 'Choose store & frequency', 'Set quantity & unit', 'Save'],
        icon: ShoppingBasket,
        color: 'border-l-rose-500',
        iconBg: 'bg-rose-50 text-rose-600',
      },
      {
        action: 'Download shopping list PDF',
        steps: ['Go to Groceries', 'Open "Shopping Lists" tab', 'Apply filters (optional)', 'Click "Download PDF"'],
        icon: ShoppingBasket,
        color: 'border-l-rose-500',
        iconBg: 'bg-rose-50 text-rose-600',
      },
      {
        action: 'Mark item as purchased',
        steps: ['Find the item in list', 'Toggle the checkbox', 'Stock status updates instantly'],
        icon: ShoppingBasket,
        color: 'border-l-rose-500',
        iconBg: 'bg-rose-50 text-rose-600',
      },
    ],
  },
  {
    title: 'Meal Planning',
    description: 'Plan and customize weekly meals',
    items: [
      {
        action: 'Edit a meal',
        steps: ['Go to Meals page', 'Click any cell in the grid', 'Edit name, calories, flags', 'Save changes'],
        icon: CalendarDays,
        color: 'border-l-amber-500',
        iconBg: 'bg-amber-50 text-amber-600',
      },
      {
        action: 'Generate meal plans',
        steps: ['Go to Command Center', 'Open "Meal Plans" tab', 'Select a member (or all)', 'Click "Generate"'],
        icon: CalendarDays,
        color: 'border-l-amber-500',
        iconBg: 'bg-amber-50 text-amber-600',
      },
      {
        action: 'Add a recipe',
        steps: ['Go to Command Center', 'Open "Recipes" tab', 'Click "Add Recipe"', 'Fill ingredients & details', 'Save'],
        icon: CalendarDays,
        color: 'border-l-amber-500',
        iconBg: 'bg-amber-50 text-amber-600',
      },
    ],
  },
  {
    title: 'Admin & Security',
    description: 'Manage family, devices, and invites',
    items: [
      {
        action: 'Invite a new member',
        steps: ['Command Center → Security', 'Click "Create Invite"', 'Set role & expiry', 'Share link or QR code'],
        icon: LayoutGrid,
        color: 'border-l-slate-500',
        iconBg: 'bg-slate-100 text-slate-600',
      },
      {
        action: 'Revoke a device',
        steps: ['Command Center → Security', 'Find device in list', 'Click "Revoke"', 'All sessions blocked instantly'],
        icon: LayoutGrid,
        color: 'border-l-slate-500',
        iconBg: 'bg-slate-100 text-slate-600',
      },
      {
        action: 'Change password',
        steps: ['Command Center → Security', 'Enter current password', 'Enter new password (2×)', 'Submit'],
        icon: LayoutGrid,
        color: 'border-l-slate-500',
        iconBg: 'bg-slate-100 text-slate-600',
      },
    ],
  },
  {
    title: 'General Navigation',
    description: 'Shortcuts and quick actions',
    items: [
      {
        action: 'Search anything (Ctrl+K)',
        steps: ['Press Ctrl+K or Cmd+K', 'Type your query', 'Select from fuzzy results', 'Jump to item instantly'],
        icon: Search,
        color: 'border-l-indigo-500',
        iconBg: 'bg-indigo-50 text-indigo-600',
      },
      {
        action: 'Toggle dark mode',
        steps: ['Click Moon/Sun icon in header', 'Theme persists across sessions'],
        icon: Moon,
        color: 'border-l-indigo-500',
        iconBg: 'bg-indigo-50 text-indigo-600',
      },
      {
        action: 'Post an announcement',
        steps: ['Go to Family page', 'Find Announcements section', 'Type your message', 'Click "Post"'],
        icon: Users,
        color: 'border-l-blue-500',
        iconBg: 'bg-blue-50 text-blue-600',
      },
    ],
  },
]

export const DemoHowTo = () => (
  <div className="grid gap-6">
    {/* Header */}
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
          <Command className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">How To — Quick Reference</h3>
          <p className="text-sm text-slate-500">Visual step-by-step paths for every common action</p>
        </div>
      </div>
    </div>

    {/* Categories */}
    {categories.map((cat) => (
      <div key={cat.title} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h4 className="font-bold text-slate-800">{cat.title}</h4>
          <p className="text-xs text-slate-500">{cat.description}</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {cat.items.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.action}
                className={cn(
                  'group rounded-xl border border-slate-100 border-l-4 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg',
                  item.color,
                )}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <div className={cn('flex size-8 items-center justify-center rounded-lg', item.iconBg)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{item.action}</p>
                </div>

                {/* Visual step path */}
                <div className="space-y-1.5">
                  {item.steps.map((step, idx) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
                        {idx + 1}
                      </div>
                      <div className="text-xs text-slate-600">{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ))}

    {/* Keyboard shortcuts */}
    <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
      <h4 className="mb-4 text-sm font-bold text-slate-300">⌨️ Keyboard Shortcuts</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { keys: 'Ctrl + K', action: 'Open command palette' },
          { keys: 'Escape', action: 'Close modals & panels' },
          { keys: 'Click + Drag', action: 'Reassign tasks' },
        ].map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 backdrop-blur-sm">
            <kbd className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-mono font-bold text-white">
              {shortcut.keys}
            </kbd>
            <span className="text-xs text-slate-300">{shortcut.action}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)
