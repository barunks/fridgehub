import { useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, BrainCircuit, MessageCircle, Send, Sparkles, WandSparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import { generateAssistantInsights } from '@/services/assistantEngine'
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
  const insights = generateAssistantInsights(state)

  const submitQuery = (value: string) => {
    askAssistant(value)
    setQuery('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitQuery(query)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Family Assistant</h2>
          <p className="mt-1 text-sm text-slate-500">Local recommendation engine with an API-ready AI boundary</p>
        </div>
        <Badge tone="violet">AI enriched React UI</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Ask AI</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Schedule, grocery, meal, and family context are included</p>
            </div>
            <Bot className="size-6 text-blue-600" aria-hidden="true" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid max-h-[520px] gap-3 overflow-auto rounded-lg bg-slate-50 p-3 scrollbar-thin">
              {state.assistantMessages.map((message) => (
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm',
                    message.sender === 'assistant'
                      ? 'justify-self-start bg-white text-slate-700'
                      : 'justify-self-end bg-blue-600 text-white',
                  )}
                  key={message.id}
                >
                  <p>{message.content}</p>
                  <p className={cn('mt-2 text-[11px]', message.sender === 'assistant' ? 'text-slate-400' : 'text-blue-100')}>
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {promptChips.map((chip) => (
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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

        <aside className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Generated from current family state</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.map((insight) => (
                <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm" key={insight.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-blue-600" aria-hidden="true" />
                      <p className="font-semibold text-slate-950">{insight.title}</p>
                    </div>
                    <Badge tone={insight.confidence > 85 ? 'green' : 'blue'}>{insight.confidence}%</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{insight.body}</p>
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
              <div className="rounded-lg bg-blue-50 p-4">
                <BrainCircuit className="mb-3 size-5 text-blue-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-blue-950">Context window</p>
                <p className="mt-1 text-sm text-blue-700">
                  Tasks, groceries, meals, family members, notifications, and announcements.
                </p>
              </div>
              <div className="rounded-lg bg-violet-50 p-4">
                <WandSparkles className="mb-3 size-5 text-violet-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-violet-950">Backend endpoint</p>
                <p className="mt-1 text-sm text-violet-700">POST /api/v1/assistant/recommendations</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
                <MessageCircle className="size-5 text-emerald-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-emerald-950">{state.assistantMessages.length} messages</p>
                  <p className="text-sm text-emerald-700">Stored locally for this demo session.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
