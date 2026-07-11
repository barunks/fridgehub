import { Suspense, lazy } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'

const HouseholdCharts = lazy(() => import('@/components/analytics/HouseholdCharts'))

export const AnalyticsView = ({ store }: { store: FamilyHubStore }) => {
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Family Analytics</h2>
        <p className="mt-1 text-sm text-slate-400">
          Task flow, pantry coverage, calories, and reward activity
        </p>
      </div>

      <ErrorBoundary fallback={<Card><CardContent className="text-sm text-slate-400">Charts unavailable.</CardContent></Card>}>
        <Suspense
          fallback={
            <Card>
              <CardContent className="py-16 text-center text-sm text-slate-400">Loading analytics charts…</CardContent>
            </Card>
          }
        >
          <HouseholdCharts store={store} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
