import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Utensils,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { AssistantInsight } from '@/types/familyHub'
import { formatTime } from '@/utils/date'
import { cn } from '@/utils/style'

const promptChips = [
  { label: 'Gaps & alerts', query: 'What gaps or alerts did we miss today?', icon: AlertTriangle, color: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
  { label: 'Overdue reminders', query: 'Which reminders are overdue or urgent?', icon: Bell, color: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { label: 'Grocery priority', query: 'Which groceries should be bought first?', icon: ShoppingBasket, color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { label: 'Meal plan gaps', query: 'Any meal plan gaps for today?', icon: Utensils, color: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { label: 'What\'s next?', query: 'What should we do next?', icon: Zap, color: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
]

const severityMeta = {
  critical: { label: 'Critical', tone: 'rose' as const, ring: 'border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50/50', icon: AlertTriangle, iconColor: 'text-rose-500' },
  warning: { label: 'Warning', tone: 'amber' as const, ring: 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50', icon: Bell, iconColor: 'text-amber-500' },
  info: { label: 'Info', tone: 'indigo' as const, ring: 'border-slate-100 bg-gradient-to-br from-slate-50 to-white', icon: CheckCircle2, iconColor: 'text-indigo-500' },
}

const typeIcon = {
  schedule: Bell,
  grocery: ShoppingBasket,
  meal: Utensils,
  task: ClipboardList,
  family: Sparkles,
}

const insightSeverity = (insight: AssistantInsight) => insight.severity ?? 'info'

export const AssistantView = ({ store }: { store: FamilyHubStore }) => {
  const { state, askAssistant, clearAssistantChat, refreshAssistantInsights } = store
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [isRefreshingInsights, setIsRefreshingInsights] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const insights = state.assistantInsights

  const summary = useMemo(() => {
    const critical = insights.filter((insight) => insightSeverity(insight) === 'critical').length
    const warnings = insights.filter((insight) => insightSeverity(insight) === 'warning').length
    const reminders = insights.filter((insight) => insight.type === 'task' || insight.type === 'schedule').length
    return { critical, warnings, reminders }
  }, [insights])

  const visibleMessages = useMemo(() => {
    const search = messageSearch.trim().toLowerCase()
    if (!search) return state.assistantMessages
    return state.assistantMessages.filter((message) => message.content.toLowerCase().includes(search))
  }, [messageSearch, state.assistantMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [state.assistantMessages.length, isSubmitting])

  const submitQuery = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      await askAssistant(trimmed)
      setQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitQuery(query)
  }

  const handleRefreshInsights = async () => {
    setIsRefreshingInsights(true)
    setError(null)
    try {
      await refreshAssistantInsights()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh assistant insights')
    } finally {
      setIsRefreshingInsights(false)
    }
  }

  return (
    <div className="grid gap-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 px-6 py-8 text-white shadow-xl shadow-indigo-400/20 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/[0.06] blur-2xl animate-[moonFloat_7s_ease-in-out_infinite]" />
          <div className="absolute -bottom-20 -left-20 size-72 rounded-full bg-teal-400/[0.08] blur-3xl animate-[moonFloat_9s_ease-in-out_infinite_2s]" />
          <div className="absolute left-[15%] top-[20%] size-2 rounded-full bg-amber-300/70 animate-[starTwinkle_2s_ease-in-out_infinite]" />
          <div className="absolute left-[60%] top-[30%] size-1.5 rounded-full bg-white/50 animate-[starTwinkle_2.5s_ease-in-out_infinite_0.7s]" />
          <div className="absolute left-[80%] top-[60%] size-2 rounded-full bg-teal-200/50 animate-[starTwinkle_3s_ease-in-out_infinite_1.2s]" />
        </div>

        <div className="relative flex flex-wrap items-center gap-5">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
            <Bot className="size-7" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Family Assistant</h2>
            <p className="mt-1 text-sm text-indigo-100">AI-powered insights from your tasks, groceries, meals, and family data</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={summary.critical > 0 ? 'rose' : 'green'} mode="pill">{summary.critical} critical</Badge>
            <Badge tone={summary.warnings > 0 ? 'amber' : 'slate'} mode="pill">{summary.warnings} warnings</Badge>
            <Badge tone="indigo" mode="pill">{summary.reminders} signals</Badge>
          </div>
        </div>
      </div>

      {/* Agent capabilities — top strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-1 lg:grid-cols-1 lg:gap-3">
          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 p-3 text-center">
            <p className="text-lg font-bold text-rose-700">{summary.critical}</p>
            <p className="text-[10px] font-medium text-rose-600">Alerts</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{summary.warnings}</p>
            <p className="text-[10px] font-medium text-amber-600">Gaps</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-3 text-center">
            <p className="text-lg font-bold text-indigo-700">{summary.reminders}</p>
            <p className="text-[10px] font-medium text-indigo-600">Signals</p>
          </div>
        </div>
        <div className="group rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 p-4 transition-all hover:shadow-sm">
          <BrainCircuit className="mb-2 size-5 text-indigo-600 transition-transform group-hover:scale-110" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900">Live context analysis</p>
          <p className="mt-1 text-xs text-slate-500">Tasks, groceries, shopping cycles, meals, members, notifications, and announcements.</p>
        </div>
        <div className="group rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-purple-50/50 p-4 transition-all hover:shadow-sm">
          <WandSparkles className="mb-2 size-5 text-violet-600 transition-transform group-hover:scale-110" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900">Specific answers</p>
          <p className="mt-1 text-xs text-slate-500">Ask about any item, member, meal slot, reminder, or missed alert.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
            <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{state.assistantMessages.length} messages</p>
            <p className="text-[11px] text-slate-500">Current session</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        {/* Chat panel */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-50/50 via-violet-50/30 to-purple-50/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Ask AI</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Questions use live household context for specific answers</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="min-h-9 px-3 py-1.5 text-xs"
                  disabled={state.assistantMessages.length === 0 || isSubmitting}
                  onClick={clearAssistantChat}
                  variant="secondary"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Clear
                </Button>
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                className={cn(inputClass, 'pl-9')}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="Search this conversation"
                value={messageSearch}
              />
            </div>

            {/* Messages area */}
            <div className="grid max-h-[520px] min-h-[320px] content-start gap-3 overflow-auto rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/50 to-white p-4 scrollbar-thin" data-testid="assistant-messages">
              {state.assistantMessages.length === 0 && (
                <div className="grid place-items-center rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/30 p-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
                    <MessageCircle className="size-6 text-indigo-500" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">Start a conversation</p>
                  <p className="mt-1 text-xs text-slate-400">Ask about alerts, groceries, meals, or use a quick prompt below</p>
                </div>
              )}
              {state.assistantMessages.length > 0 && visibleMessages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-400">
                  No messages match this search.
                </div>
              )}
              {visibleMessages.map((message) => (
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                    message.sender === 'assistant'
                      ? 'justify-self-start border border-indigo-100/60 bg-gradient-to-br from-white to-indigo-50/30 text-slate-700'
                      : 'justify-self-end bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20',
                  )}
                  key={message.id}
                >
                  {message.sender === 'assistant' && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Bot className="size-3.5 text-indigo-500" aria-hidden="true" />
                      <span className="text-[10px] font-bold text-indigo-500">AI</span>
                    </div>
                  )}
                  <p>{message.content}</p>
                  <p className={cn('mt-2 text-[10px]', message.sender === 'assistant' ? 'text-slate-400' : 'text-white/60')}>
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              ))}
              {isSubmitting && (
                <div className="max-w-[80%] justify-self-start rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="size-2 rounded-full bg-indigo-400 animate-[pulseUrgent_1s_ease-in-out_infinite]" />
                      <div className="size-2 rounded-full bg-violet-400 animate-[pulseUrgent_1s_ease-in-out_infinite_0.2s]" />
                      <div className="size-2 rounded-full bg-purple-400 animate-[pulseUrgent_1s_ease-in-out_infinite_0.4s]" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">Analyzing household data...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                {error}
              </div>
            )}

            {/* Prompt chips */}
            <div className="flex flex-wrap gap-2">
              {promptChips.map((chip) => {
                const Icon = chip.icon
                return (
                  <button
                    className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50', chip.color)}
                    disabled={isSubmitting}
                    key={chip.label}
                    onClick={() => { void submitQuery(chip.query) }}
                    type="button"
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {chip.label}
                  </button>
                )
              })}
            </div>

            {/* Input */}
            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
              <FormField className="min-w-0" label="Prompt">
                <input
                  className={inputClass}
                  disabled={isSubmitting}
                  maxLength={500}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask about alerts, groceries, meals, reminders, or members"
                  value={query}
                />
              </FormField>
              <div className="flex items-end">
                <Button className="w-full sm:w-auto" disabled={!query.trim() || isSubmitting} type="submit">
                  <Send className="size-4" aria-hidden="true" />
                  {isSubmitting ? 'Checking' : 'Send'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sidebar — Attention Queue only */}
        <aside className="grid gap-5 self-start">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 bg-gradient-to-r from-rose-50/50 to-amber-50/30">
              <div>
                <CardTitle>Attention Queue</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Sorted by severity from current household state</p>
              </div>
              <Button className="min-h-9 px-3 py-1.5 text-xs" disabled={isRefreshingInsights} onClick={handleRefreshInsights} variant="outline">
                <RefreshCw className={cn('size-3.5', isRefreshingInsights && 'animate-spin')} aria-hidden="true" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.length === 0 && (
                <div className="grid place-items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <CheckCircle2 className="size-6 text-emerald-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-slate-500">All clear — no signals</p>
                </div>
              )}
              {insights.map((insight) => {
                const severity = insightSeverity(insight)
                const SeverityIcon = severityMeta[severity].icon
                const TypeIcon = typeIcon[insight.type]
                return (
                  <div className={cn('rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5', severityMeta[severity].ring)} key={insight.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex size-7 items-center justify-center rounded-lg', severity === 'critical' ? 'bg-rose-100' : severity === 'warning' ? 'bg-amber-100' : 'bg-indigo-100')}>
                            <TypeIcon className={cn('size-3.5', severityMeta[severity].iconColor)} aria-hidden="true" />
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={severityMeta[severity].tone}>
                            <SeverityIcon className="size-3.5" aria-hidden="true" />
                            {severityMeta[severity].label}
                          </Badge>
                          <Badge tone="slate">{insight.confidence}% confidence</Badge>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-600">{insight.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {insight.route ? (
                        <Button className="min-h-8 px-3 py-1.5 text-xs" onClick={() => navigate(insight.route || '/')} variant="secondary">
                          {insight.action || 'Open'}
                        </Button>
                      ) : (
                        insight.action && <Badge tone="slate">{insight.action}</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
