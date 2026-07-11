import { Code2, Database, Layers3, Rocket, Server, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
    items: ['FastAPI REST resources', 'JWT access tokens and HttpOnly refresh cookies', 'Service layer per domain', 'Celery schedules'],
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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Implementation Readiness</h2>
          <p className="mt-1 text-sm text-slate-400">UI scope aligned to the Family_Hub.docx plan</p>
        </div>
        <Button variant="danger" onClick={resetDemoData}>
          Reset demo data
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {implementationTracks.map((track) => {
          const Icon = track.icon
          return (
            <Card key={track.title} className="group">
              <CardHeader>
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-transform duration-200 group-hover:scale-110">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{track.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2.5 text-sm text-slate-500">
                  {track.items.map((item) => (
                    <li className="flex items-start gap-2" key={item}>
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>API Integration Map</CardTitle>
            <p className="mt-1 text-xs text-slate-400">UI actions are isolated behind replaceable state methods</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100/80 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Method</th>
                  <th className="px-6 py-3.5">Endpoint</th>
                  <th className="px-6 py-3.5">UI usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {apiResources.map(([method, endpoint, usage]) => (
                  <tr className="transition-colors hover:bg-slate-50/50" key={`${method}-${endpoint}`}>
                    <td className="px-6 py-4">
                      <Badge tone={method === 'GET' ? 'green' : 'indigo'}>{method}</Badge>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{endpoint}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-5">
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
            <CardContent className="grid gap-2.5">
              {[
                'users, families, family_members',
                'grocery_list_types, grocery_items, grocery_purchase_cycles',
                'tasks, meal_plans, meal_plan_templates, recipes',
                'notifications, audit_logs, frequency_types',
              ].map((item) => (
                <div className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-3.5 text-xs text-slate-500" key={item}>
                  <Code2 className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden="true" />
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
