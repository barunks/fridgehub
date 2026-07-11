import { useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, BrainCircuit, MessageCircle, Send, Sparkles, WandSparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import { formatTime } from '@/utils/date'
import { cn } from '@/utils/style'

const promptChips = [
  'What should we do next today?',
  'Which groceries are urgent?',
  'What can we cook for dinner?',
  'When should we leave for school?',
]

export const AssistantView = ({ store }: { store: FamilyHubStore }) => {
  const { state, askAssistant } = store
  const [query, setQuery] = useState('')
  const insights = state.assistantInsights

  const submitQuery = (value: string) => {
    askAssistant(value)
    setQuery('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitQuery(query)
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Family Assistant</h2>
          <p className="mt-1 text-sm text-slate-400">Backend recommendations using household context</p>
        </div>
        <Badge tone="violet">AI recommendations</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Ask AI</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Schedule, grocery, meal, and family context included</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50">
              <Bot className="size-5 text-indigo-600" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid max-h-[520px] gap-3 overflow-auto rounded-2xl bg-slate-50/80 p-4 scrollbar-thin">
              {state.assistantMessages.map((message) => (
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                    message.sender === 'assistant'
                      ? 'justify-self-start bg-white text-slate-700 border border-slate-100/80'
                      : 'justify-self-end bg-gradient-to-r from-indigo-600 to-blue-600 text-white',
                  )}
                  key={message.id}
                >
                  <p>{message.content}</p>
                  <p className={cn('mt-2 text-[10px]', message.sender === 'assistant' ? 'text-slate-400' : 'text-white/60')}>
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {promptChips.map((chip) => (
                <button
                  className="rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 hover:shadow-md active:scale-[0.97]"
                  key={chip}
                  onClick={() => submitQuery(chip)}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
              <FormField className="min-w-0" label="Prompt">
                <input
                  className={inputClass}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask about groceries, tasks, meals, or timing"
                  value={query}
                />
              </FormField>
              <div className="flex items-end">
                <Button className="w-full sm:w-auto" type="submit">
                  <Send className="size-4" aria-hidden="true" />
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Generated from current family state</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.map((insight) => (
                <div className="rounded-xl border border-slate-100/80 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md" key={insight.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-indigo-500" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                    </div>
                    <Badge tone={insight.confidence > 85 ? 'green' : 'indigo'}>{insight.confidence}%</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{insight.body}</p>
                  {insight.action && <Badge className="mt-3" tone="slate">{insight.action}</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Inputs</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-xl bg-indigo-50/80 p-4">
                <BrainCircuit className="mb-2.5 size-5 text-indigo-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Context window</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tasks, groceries, meals, family members, notifications, and announcements.
                </p>
              </div>
              <div className="rounded-xl bg-violet-50/80 p-4">
                <WandSparkles className="mb-2.5 size-5 text-violet-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Backend endpoint</p>
                <p className="mt-1 text-xs text-slate-500">POST /api/v1/assistant/recommendations</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50/80 p-4">
                <MessageCircle className="size-5 text-emerald-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{state.assistantMessages.length} messages</p>
                  <p className="text-xs text-slate-500">Loaded from the current app session.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
