import { useState } from 'react'
import { DemoHero } from './DemoHero'
import { DemoWorkflow } from './DemoWorkflow'
import { DemoModules } from './DemoModules'
import { DemoHowTo } from './DemoHowTo'
import { DemoFaq } from './DemoFaq'
import type { FridgeHubStore } from '@/hooks/useFridgeHub'

type DemoTab = 'overview' | 'modules' | 'howto' | 'faq'

export const DemoView = ({ store: _store }: { store: FridgeHubStore }) => {
  const [tab, setTab] = useState<DemoTab>('overview')

  const tabs: { key: DemoTab; label: string }[] = [
    { key: 'overview', label: 'Overview & Flow' },
    { key: 'modules', label: 'Module Guides' },
    { key: 'howto', label: 'How To' },
    { key: 'faq', label: 'FAQ' },
  ]

  return (
    <div className="grid gap-8">
      <DemoHero />

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 backdrop-blur-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            type="button"
            className={
              tab === t.key
                ? 'flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all'
                : 'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in-up">
        {tab === 'overview' && <DemoWorkflow />}
        {tab === 'modules' && <DemoModules />}
        {tab === 'howto' && <DemoHowTo />}
        {tab === 'faq' && <DemoFaq />}
      </div>
    </div>
  )
}
