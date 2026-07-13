import { BarChart3 } from 'lucide-react'
import { Suspense, lazy } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'

const HouseholdCharts = lazy(() => import('@/components/analytics/HouseholdCharts'))

export const AnalyticsView = ({ store }: { store: FamilyHubStore }) => {
  return (
    <div className="grid gap-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-8 text-white shadow-xl shadow-violet-400/20 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/[0.06] blur-2xl animate-[moonFloat_7s_ease-in-out_infinite]" />
          <div className="absolute -bottom-20 -left-20 size-72 rounded-full bg-amber-300/[0.07] blur-3xl animate-[moonFloat_9s_ease-in-out_infinite_2s]" />
          <div className="absolute left-[30%] top-[20%] size-2 rounded-full bg-amber-200/70 animate-[starTwinkle_2s_ease-in-out_infinite]" />
          <div className="absolute left-[72%] top-[65%] size-1.5 rounded-full bg-white/50 animate-[starTwinkle_2.8s_ease-in-out_infinite_1s]" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
            <BarChart3 className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Family Analytics</h2>
            <p className="mt-0.5 text-sm text-violet-100">Task flow, pantry coverage, calories, and reward activity</p>
          </div>
        </div>
      </div>

      <ErrorBoundary fallback={<Card><CardContent className="text-sm text-slate-400">Charts unavailable.</CardContent></Card>}>
        <Suspense
          fallback={
            <Card>
              <CardContent className="py-16 text-center text-sm text-slate-400">Loading analytics charts...</CardContent>
            </Card>
          }
        >
          <HouseholdCharts store={store} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
