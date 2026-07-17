import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, Search, ShoppingBasket, Users, X } from 'lucide-react'
import type { FridgeHubStore } from '@/hooks/useFridgeHub'
import { cn } from '@/utils/style'

interface SearchResult {
  id: string
  label: string
  sublabel: string
  icon: typeof Search
  path: string
}

interface CommandPaletteProps {
  store: FridgeHubStore
}

const fuzzyMatch = (query: string, text: string): boolean => {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t.includes(q)) return true
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

export const CommandPalette = ({ store }: CommandPaletteProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return []
    const q = query.trim()
    const items: SearchResult[] = []

    for (const task of store.state.tasks) {
      if (fuzzyMatch(q, task.title) || fuzzyMatch(q, task.category)) {
        items.push({ id: `task-${task.id}`, label: task.title, sublabel: `Task - ${task.category} - ${task.status}`, icon: ClipboardList, path: '/tasks' })
      }
    }
    for (const item of store.state.groceryItems) {
      if (fuzzyMatch(q, item.itemName)) {
        items.push({ id: `grocery-${item.id}`, label: item.itemName, sublabel: `Grocery - ${item.purchaseFrequency}`, icon: ShoppingBasket, path: '/groceries' })
      }
    }
    for (const meal of store.state.meals) {
      if (fuzzyMatch(q, meal.mealName)) {
        items.push({ id: `meal-${meal.id}`, label: meal.mealName, sublabel: `Meal - ${meal.dayOfWeek} ${meal.mealType}`, icon: CalendarDays, path: '/meals' })
      }
    }
    for (const member of store.state.members) {
      if (fuzzyMatch(q, member.name)) {
        items.push({ id: `member-${member.id}`, label: member.name, sublabel: `Family - ${member.role}`, icon: Users, path: '/family' })
      }
    }
    return items.slice(0, 12)
  }, [query, store.state])

  const selectResult = useCallback((result: SearchResult) => {
    setOpen(false)
    navigate(result.path)
  }, [navigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      selectResult(results[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg animate-scale-in rounded-2xl border border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100/80 px-5 py-4">
          <Search className="size-5 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, groceries, meals, members..."
            type="text"
            value={query}
          />
          <kbd className="hidden rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-400 sm:inline">
            ESC
          </kbd>
          <button className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" onClick={() => setOpen(false)} type="button">
            <X className="size-4" />
          </button>
        </div>

        {query.trim() && (
          <div className="max-h-72 overflow-auto p-2.5">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">No results found</p>
            ) : (
              results.map((result, index) => {
                const Icon = result.icon
                return (
                  <button
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-all duration-150',
                      index === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
                    )}
                    key={result.id}
                    onClick={() => selectResult(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    type="button"
                  >
                    <Icon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{result.label}</p>
                      <p className="truncate text-[11px] opacity-60">{result.sublabel}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}

        {!query.trim() && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Start typing to search across tasks, groceries, meals, and family members
          </div>
        )}
      </div>
    </div>
  )
}
