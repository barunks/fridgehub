import { Code2, Database, Layers3, Rocket, Server, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'

const implementationTracks = [
  {
    title: 'Frontend',
    icon: Layers3,
    items: ['React + TypeScript', 'TailwindCSS styling', 'Componentized domain views', 'Local state persistence'],
  },
  {
    title: 'Backend Boundary',
    icon: Server,
    items: ['FastAPI REST resources', 'JWT auth and refresh tokens', 'Service layer per domain', 'Celery schedules'],
  },
  {
    title: 'Data Layer',
    icon: Database,
    items: ['MySQL master tables', 'Purchase cycle tables', 'Meal templates', 'Audit and notification logs'],
  },
  {
    title: 'Production',
    icon: Rocket,
    items: ['Docker compose path', 'Redis cache strategy', 'PWA-ready UI', 'Monitoring hooks'],
  },
]

const apiResources = [
  ['GET', '/api/v1/grocery/list-types', 'List type selector and cycle filtering'],
  ['POST', '/api/v1/grocery/items', 'Master grocery creation'],
  ['POST', '/api/v1/grocery/regenerate-cycles', 'Cycle generation action'],
  ['GET', '/api/v1/tasks', 'Reminder board'],
  ['POST', '/api/v1/tasks', 'Add reminder form'],
  ['GET', '/api/v1/meal-plan/week', 'Weekly meal grid'],
  ['POST', '/api/v1/assistant/recommendations', 'AI recommendation panel'],
]

export const ImplementationView = ({ store }: { store: FamilyHubStore }) => {
  const { resetDemoData } = store

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Implementation Readiness</h2>
          <p className="mt-1 text-sm text-slate-500">UI scope aligned to the Family_Hub.docx implementation plan</p>
        </div>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          onClick={resetDemoData}
          type="button"
        >
          Reset demo data
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {implementationTracks.map((track) => {
          const Icon = track.icon

          return (
            <Card key={track.title}>
              <CardHeader>
                <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{track.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm text-slate-600">
                  {track.items.map((item) => (
                    <li className="flex items-start gap-2" key={item}>
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>API Integration Map</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Current UI actions are isolated behind replaceable state methods</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Endpoint</th>
                  <th className="px-5 py-3">UI usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiResources.map(([method, endpoint, usage]) => (
                  <tr key={`${method}-${endpoint}`}>
                    <td className="px-5 py-4">
                      <Badge tone={method === 'GET' ? 'green' : 'blue'}>{method}</Badge>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-700">{endpoint}</td>
                    <td className="px-5 py-4 text-slate-600">{usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Command Center Reference</CardTitle>
            </CardHeader>
            <img
              alt="FamilyHub command center reference"
              className="aspect-[1600/908] w-full object-cover"
              src="/assets/familyhub-command-center.jpeg"
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schema Coverage</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                'users, families, family_members',
                'grocery_list_types, grocery_items, grocery_purchase_cycles',
                'tasks, meal_plans, meal_plan_templates, recipes',
                'notifications, audit_logs, frequency_types',
              ].map((item) => (
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600" key={item}>
                  <Code2 className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
