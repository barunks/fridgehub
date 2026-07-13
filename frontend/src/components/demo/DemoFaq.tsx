import { useState } from 'react'
import { ChevronDown, HelpCircle, Lock, MessageCircle, Search, Settings, ShoppingBasket, Utensils, Zap } from 'lucide-react'
import { cn } from '@/utils/style'

interface FaqItem {
  question: string
  answer: string
  category: string
}

const faqItems: FaqItem[] = [
  {
    category: 'Getting Started',
    question: 'How do I add a new family member?',
    answer: 'Go to Command Center → Security tab → Create Invite. Set the role (parent/child), permissions, and expiry (1–30 days). Share the invite link or QR code. The new member signs up with their own credentials and device — no open registration allowed.',
  },
  {
    category: 'Getting Started',
    question: 'What happens on first launch (bootstrap)?',
    answer: 'When the database is empty, the app shows a "Setup" tab on the login page. The first user creates the family, becomes admin, and gets default grocery places + meal templates seeded automatically. After bootstrap, only invite-based signup works.',
  },
  {
    category: 'Getting Started',
    question: 'How do I navigate the app?',
    answer: 'Use the sidebar on desktop or bottom navigation on mobile. Press Ctrl+K (Cmd+K on Mac) to open the command palette for instant fuzzy search across all modules. Each section is accessible from the main navigation.',
  },
  {
    category: 'Permissions & Roles',
    question: 'Can children see everything parents see?',
    answer: 'No. Children have read-only access to dashboard, tasks, groceries, meals, family, and analytics. They cannot access the Command Center, create/delete items, or manage other members. Parents control all write operations through role-based access control.',
  },
  {
    category: 'Permissions & Roles',
    question: 'What\'s the difference between parent and admin roles?',
    answer: 'Both have full permissions. "Admin" is the bootstrap creator. "Parent", "Mom", "Dad", and "Guardian" all get the same parent-level access. The distinction is cosmetic for display purposes — all parent-type roles can manage everything.',
  },
  {
    category: 'Security & Devices',
    question: 'What happens if I lose my device?',
    answer: 'A parent can revoke the lost device from Command Center → Security → Device Management. This immediately blocks ALL sessions from that device. The user can then log in from a new device — it gets registered automatically on first login.',
  },
  {
    category: 'Security & Devices',
    question: 'How are passwords and tokens stored?',
    answer: 'Passwords are hashed with bcrypt (never stored in plain text). Access tokens are kept in browser memory only (not localStorage). Refresh tokens use HttpOnly cookies that can\'t be read by JavaScript. Every session is tied to a registered device.',
  },
  {
    category: 'Security & Devices',
    question: 'What is rate limiting?',
    answer: 'Login, signup, and bootstrap endpoints are limited to 10 attempts per minute per IP address. This prevents brute-force attacks. After exceeding the limit, you\'ll need to wait before trying again.',
  },
  {
    category: 'Groceries & Shopping',
    question: 'How do purchase cycles work?',
    answer: 'Each item has a frequency (weekly, monthly, etc.). The system auto-generates cycles based on these. When a weekly cycle ends, unpurchased items carry forward to the next cycle. Use "Regenerate Cycles" in Command Center to reset manually.',
  },
  {
    category: 'Groceries & Shopping',
    question: 'Can I shop at multiple stores?',
    answer: 'Yes! Items are organized by shopping place (Wet Market, Super Market, Murugan, NTUC by default). Each store has independent cycles. You can add/remove stores from Command Center → Grocery Places tab.',
  },
  {
    category: 'Meals & Recipes',
    question: 'Can each family member have different meals?',
    answer: 'Yes! Per-member meal plans let each person have their own weekly plan. Parents generate plans from the family template, then customize per individual — different meals, calories, or dietary flags without affecting other members.',
  },
  {
    category: 'Meals & Recipes',
    question: 'What is the meal template?',
    answer: 'The template is a master weekly plan (7 days × 4 meals = 28 slots) seeded during bootstrap. When you "Generate" a plan for a member, it copies the template into their personal plan. You can then customize individual meals without changing the template.',
  },
]

const categoryIcons: Record<string, { icon: typeof Zap; color: string }> = {
  'Getting Started': { icon: Zap, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  'Permissions & Roles': { icon: Settings, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  'Security & Devices': { icon: Lock, color: 'bg-rose-50 text-rose-600 border-rose-200' },
  'Groceries & Shopping': { icon: ShoppingBasket, color: 'bg-amber-50 text-amber-600 border-amber-200' },
  'Meals & Recipes': { icon: Utensils, color: 'bg-violet-50 text-violet-600 border-violet-200' },
}

const allCategories = [...new Set(faqItems.map((i) => i.category))]

export const DemoFaq = () => {
  const [openId, setOpenId] = useState<string | null>(faqItems[0].question)
  const [filter, setFilter] = useState('')

  const filtered = filter
    ? faqItems.filter((item) => item.question.toLowerCase().includes(filter.toLowerCase()) || item.answer.toLowerCase().includes(filter.toLowerCase()))
    : faqItems

  const visibleCategories = allCategories.filter((cat) => filtered.some((item) => item.category === cat))

  return (
    <div className="grid gap-6">
      {/* Header with search */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20">
              <HelpCircle className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Frequently Asked Questions</h3>
              <p className="text-sm text-slate-500">{faqItems.length} answers · {allCategories.length} categories</p>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-64"
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search questions..."
              type="text"
              value={filter}
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {allCategories.map((cat) => {
            const meta = categoryIcons[cat] ?? categoryIcons['Getting Started']
            const Icon = meta.icon
            const count = faqItems.filter((i) => i.category === cat).length
            return (
              <span key={cat} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium', meta.color)}>
                <Icon className="size-3" aria-hidden="true" />
                {cat}
                <span className="ml-0.5 rounded-full bg-white/60 px-1.5 text-[10px]">{count}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* FAQ sections */}
      {visibleCategories.map((category) => {
        const meta = categoryIcons[category] ?? categoryIcons['Getting Started']
        const Icon = meta.icon
        const items = filtered.filter((item) => item.category === category)

        return (
          <div key={category} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3.5">
              <div className={cn('flex size-7 items-center justify-center rounded-lg border', meta.color)}>
                <Icon className="size-3.5" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-slate-700">{category}</p>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{items.length} questions</span>
            </div>

            {/* Questions */}
            <div className="divide-y divide-slate-50">
              {items.map((item) => {
                const isOpen = openId === item.question
                return (
                  <div key={item.question} className="transition-colors hover:bg-slate-50/30">
                    <button
                      className="flex w-full items-start gap-3 px-6 py-4 text-left"
                      onClick={() => setOpenId(isOpen ? null : item.question)}
                      type="button"
                    >
                      <MessageCircle className={cn('mt-0.5 size-4 shrink-0 transition-colors', isOpen ? 'text-indigo-500' : 'text-slate-300')} aria-hidden="true" />
                      <span className={cn('flex-1 text-sm font-medium leading-relaxed transition-colors', isOpen ? 'text-indigo-800' : 'text-slate-700')}>
                        {item.question}
                      </span>
                      <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180 text-indigo-500')} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <div className="animate-fade-in-up border-t border-slate-50 bg-indigo-50/20 px-6 py-4 pl-[3.25rem]">
                        <p className="text-sm leading-relaxed text-slate-600">{item.answer}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <Search className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-500">No questions match "{filter}"</p>
          <button
            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            onClick={() => setFilter('')}
            type="button"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  )
}
