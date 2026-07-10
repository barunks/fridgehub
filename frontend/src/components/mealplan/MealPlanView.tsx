import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, ChefHat, ClipboardCheck, Save } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { MealPlanItem, MealType } from '@/types/familyHub'
import { cn } from '@/utils/style'

const mealColumns: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const MealPlanView = ({ store }: { store: FamilyHubStore }) => {
  const { state, mealsByDay, updateMeal, applyWeeklyTemplate } = store
  const [selectedMealId, setSelectedMealId] = useState<number>(state.meals[0]?.id ?? 0)
  const selectedMeal = state.meals.find((meal) => meal.id === selectedMealId)
  const [draftName, setDraftName] = useState(selectedMeal?.mealName ?? '')

  const mealStats = useMemo(() => {
    const averagePrep = Math.round(
      state.meals.reduce((total, meal) => total + meal.prepTime, 0) / Math.max(1, state.meals.length),
    )
    const weeklyCalories = state.meals.reduce((total, meal) => total + meal.calories, 0)

    return { averagePrep, weeklyCalories }
  }, [state.meals])

  const selectMeal = (meal: MealPlanItem) => {
    setSelectedMealId(meal.id)
    setDraftName(meal.mealName)
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (selectedMeal && draftName.trim()) {
      updateMeal(selectedMeal.id, draftName.trim())
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Weekly Meal Plan</h2>
          <p className="mt-1 text-sm text-slate-500">Template-driven meals, recipes, nutrition, and grocery signals</p>
        </div>
        <Button
          onClick={() => {
            if (window.confirm('Apply the weekly meal template to this week?')) {
              applyWeeklyTemplate()
            }
          }}
        >
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Apply template
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Week Grid</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Breakfast, lunch, snacks, and dinner by day</p>
            </div>
            <Badge tone="green">{state.meals.length} meals</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[900px] p-5">
                <div className="grid grid-cols-[110px_repeat(4,minmax(150px,1fr))] gap-3">
                  <div />
                  {mealColumns.map((column) => (
                    <div className="text-center text-xs font-bold uppercase tracking-wide text-slate-500" key={column.key}>
                      {column.label}
                    </div>
                  ))}

                  {dayOrder.map((day) => (
                    <div className="contents" key={day}>
                      <div className="flex items-center justify-end pr-2 text-sm font-bold uppercase text-slate-600">
                        {day}
                      </div>
                      {mealColumns.map((column) => {
                        const meal = mealsByDay[day]?.find((item) => item.mealType === column.key)
                        const active = meal?.id === selectedMealId

                        return (
                          <button
                            className={cn(
                              'flex min-h-28 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold leading-6 text-white shadow-sm transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                              meal?.colorClass,
                              active && 'ring-4 ring-slate-900/15',
                            )}
                            key={`${day}-${column.key}`}
                            onClick={() => meal && selectMeal(meal)}
                            type="button"
                          >
                            {meal?.mealName}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Selected Meal</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Meal plan row maps to meal_plans and templates</p>
            </CardHeader>
            <CardContent>
              {selectedMeal ? (
                <form className="grid gap-3" onSubmit={handleSave}>
                  <Badge tone="blue">
                    {selectedMeal.dayOfWeek} {selectedMeal.mealType}
                  </Badge>
                  <FormField label="Meal name">
                    <textarea
                      className={cn(inputClass, 'min-h-24 resize-none')}
                      onChange={(event) => setDraftName(event.target.value)}
                      value={draftName}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Calories</p>
                      <p className="text-lg font-bold text-slate-950">{selectedMeal.calories}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Prep time</p>
                      <p className="text-lg font-bold text-slate-950">{selectedMeal.prepTime}m</p>
                    </div>
                  </div>
                  <Button type="submit">
                    <Save className="size-4" aria-hidden="true" />
                    Save meal
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-slate-500">No meal selected.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recipe Library</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Reusable meals and smart substitutions</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state.recipes.map((recipe) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={recipe.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-950">{recipe.recipeName}</p>
                      <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>
                    </div>
                    <ChefHat className="size-5 text-emerald-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipe.dietaryTags.map((tag) => (
                      <Badge key={tag} tone="teal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Signals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-700">Average prep</p>
                <p className="text-xl font-bold text-blue-950">{mealStats.averagePrep}m</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Weekly calories</p>
                <p className="text-xl font-bold text-emerald-950">{mealStats.weeklyCalories}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Source Reference</CardTitle>
            </CardHeader>
            <img
              alt="Weekly meal plan reference"
              className="aspect-[964/1372] w-full object-cover"
              src="/assets/weekly-meal-plan.jpeg"
            />
            <CardContent className="flex items-center gap-2 text-sm text-slate-500">
              <BookOpen className="size-4" aria-hidden="true" />
              Screenshot meal names are seeded into the grid.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
