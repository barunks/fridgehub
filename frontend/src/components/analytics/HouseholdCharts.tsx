import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { TaskStatus } from '@/types/familyHub'

const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const chartPalette = ['#2563eb', '#10b981', '#f59e0b', '#e11d48', '#7c3aed', '#0891b2']
const axisColor = '#64748b'
const gridColor = '#dbe3ee'
const tooltipStyle = {
  border: '1px solid #dbe3ee',
  borderRadius: 8,
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
}

export const HouseholdCharts = ({ store }: { store: FamilyHubStore }) => {
  const { state } = store

  const taskStatusData = useMemo(() => {
    return Object.entries(taskStatusLabels)
      .map(([status, label]) => ({
        name: label,
        value: state.tasks.filter((task) => task.status === status).length,
      }))
      .filter((item) => item.value > 0)
  }, [state.tasks])

  const groceryData = useMemo(() => {
    return state.listTypes.map((listType) => {
      const items = state.groceryItems.filter((item) => item.listTypeId === listType.id)
      return {
        name: listType.listName.replace(' Shopping List', ''),
        low: items.filter((item) => !item.currentStock).length,
        stocked: items.filter((item) => item.currentStock).length,
      }
    })
  }, [state.groceryItems, state.listTypes])

  const caloriesData = useMemo(() => {
    return dayOrder.map((day) => ({
      day: day.slice(0, 3),
      calories: state.meals
        .filter((meal) => meal.dayOfWeek === day)
        .reduce((total, meal) => total + meal.calories, 0),
    }))
  }, [state.meals])

  const memberPointsData = useMemo(() => {
    return state.members.map((member) => ({
      name: member.name,
      points: member.points,
    }))
  }, [state.members])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Household Analytics</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Task flow, pantry coverage, calories, and reward activity</p>
        </div>
        <Badge tone="violet">Live charts</Badge>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-100 bg-slate-50 p-4" aria-label="Task status chart">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">Task Status</h3>
            <Badge tone="slate">{state.tasks.length} total</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie data={taskStatusData} dataKey="value" innerRadius={58} nameKey="name" outerRadius={86} paddingAngle={4}>
                  {taskStatusData.map((entry, index) => (
                    <Cell fill={chartPalette[index % chartPalette.length]} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {taskStatusData.map((item, index) => (
              <span className="inline-flex items-center gap-2 text-xs text-slate-600" key={item.name}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-100 bg-slate-50 p-4" aria-label="Grocery stock chart">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">Grocery Coverage</h3>
            <Badge tone="amber">Low vs stocked</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={groceryData}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={axisColor} tickLine={false} />
                <YAxis allowDecimals={false} stroke={axisColor} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="low" fill="#f59e0b" name="Low stock" radius={[6, 6, 0, 0]} />
                <Bar dataKey="stocked" fill="#10b981" name="In stock" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-slate-100 bg-slate-50 p-4" aria-label="Meal calories chart">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">Weekly Calories</h3>
            <Badge tone="green">Meal plan</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={caloriesData}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={axisColor} tickLine={false} />
                <YAxis stroke={axisColor} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  dataKey="calories"
                  dot={{ r: 4, strokeWidth: 2 }}
                  name="Calories"
                  stroke="#2563eb"
                  strokeWidth={3}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-slate-100 bg-slate-50 p-4" aria-label="Reward points chart">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">Reward Points</h3>
            <Badge tone="blue">Family</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={memberPointsData} layout="vertical">
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
                <XAxis allowDecimals={false} stroke={axisColor} tickLine={false} type="number" />
                <YAxis dataKey="name" stroke={axisColor} tickLine={false} type="category" width={74} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="points" fill="#7c3aed" name="Points" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

export default HouseholdCharts
