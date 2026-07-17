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
import type { FridgeHubStore } from '@/hooks/useFridgeHub'
import type { TaskStatus } from '@/types/familyHub'

const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const chartPalette = ['#6366f1', '#10b981', '#f59e0b', '#e11d48', '#7c3aed', '#0891b2']
const axisColor = '#94a3b8'
const gridColor = '#e2e8f0'
const tooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
  fontSize: 12,
}

export const HouseholdCharts = ({ store }: { store: FridgeHubStore }) => {
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
          <p className="mt-1 text-xs text-slate-400">Task flow, pantry coverage, calories, and rewards</p>
        </div>
        <Badge tone="violet">Live charts</Badge>
      </CardHeader>
      <CardContent className="stagger-children grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-100/80 bg-slate-50/50 p-5" aria-label="Task status chart">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Task Status</h3>
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
          <div className="mt-3 flex flex-wrap gap-3">
            {taskStatusData.map((item, index) => (
              <span className="inline-flex items-center gap-2 text-[11px] text-slate-500" key={item.name}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100/80 bg-slate-50/50 p-5" aria-label="Grocery stock chart">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Grocery Coverage</h3>
            <Badge tone="amber">Low vs stocked</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={groceryData}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={axisColor} tickLine={false} fontSize={11} />
                <YAxis allowDecimals={false} stroke={axisColor} tickLine={false} fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="low" fill="#f59e0b" name="Low stock" radius={[8, 8, 0, 0]} />
                <Bar dataKey="stocked" fill="#10b981" name="In stock" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100/80 bg-slate-50/50 p-5" aria-label="Meal calories chart">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Weekly Calories</h3>
            <Badge tone="green">Meal plan</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={caloriesData}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={axisColor} tickLine={false} fontSize={11} />
                <YAxis stroke={axisColor} tickLine={false} fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  dataKey="calories"
                  dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                  name="Calories"
                  stroke="#6366f1"
                  strokeWidth={3}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100/80 bg-slate-50/50 p-5" aria-label="Reward points chart">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Reward Points</h3>
            <Badge tone="indigo">Family</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={memberPointsData} layout="vertical">
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
                <XAxis allowDecimals={false} stroke={axisColor} tickLine={false} type="number" fontSize={11} />
                <YAxis dataKey="name" stroke={axisColor} tickLine={false} type="category" width={74} fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="points" fill="#6366f1" name="Points" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

export default HouseholdCharts
