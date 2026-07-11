import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, CalendarCheck2, ChefHat, ClipboardCheck, Clock3, Flame, Gauge, Save, Timer } from 'lucide-react'
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
  const { state, mealsByDay, updateMeal, applyWeeklyTemplate, loadRecipePage } = store
  const canManageMeals = store.can('manage_meals')
  const page = store.pagination.recipes
  const recipes = store.paged.recipes ?? state.recipes
  const [selectedMealId, setSelectedMealId] = useState<number>(state.meals[0]?.id ?? 0)
  const selectedMeal = state.meals.find((meal) => meal.id === selectedMealId)
  const [draftName, setDraftName] = useState(selectedMeal?.mealName ?? '')

  useEffect(() => {
    loadRecipePage(0)
  }, [loadRecipePage])

  const mealStats = useMemo(() => {
    const averagePrep = Math.round(
      state.meals.reduce((total, meal) => total + meal.prepTime, 0) / Math.max(1, state.meals.length),
    )
    const weeklyCalories = state.meals.reduce((total, meal) => total + meal.calories, 0)
    const plannedSlots = state.meals.length
    const coverage = Math.min(100, Math.round((plannedSlots / (dayOrder.length * mealColumns.length)) * 100))
    return { averagePrep, coverage, plannedSlots, weeklyCalories }
  }, [state.meals])

  const selectedRecipe = selectedMeal?.recipeId
    ? state.recipes.find((recipe) => recipe.id === selectedMeal.recipeId)
    : undefined

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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Weekly Meal Plan</h2>
          <p className="mt-1 text-sm text-slate-400">Template-driven meals, recipes, and nutrition</p>
        </div>
        <Button
          disabled={!canManageMeals}
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

      <Card variant="accent" className="overflow-hidden">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4">
            <Badge className="border-white/20 bg-white/15 text-white" icon={<CalendarCheck2 className="size-3.5" aria-hidden="true" />} mode="pill">
              Weekly coverage
            </Badge>
            <div>
              <h3 className="text-2xl font-bold text-white">Meals, prep time, and nutrition are visible before the week starts.</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                The grid keeps every day scannable while the side panel exposes the selected meal and matching recipe.
              </p>
            </div>
          </div>
          <div className="grid min-w-72 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white">
              <p className="text-xs text-white/70">Planned slots</p>
              <p className="text-2xl font-bold">{mealStats.plannedSlots}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white">
              <p className="text-xs text-white/70">Coverage</p>
              <p className="text-2xl font-bold">{mealStats.coverage}%</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white">
              <p className="text-xs text-white/70">Average prep</p>
              <p className="text-2xl font-bold">{mealStats.averagePrep}m</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Week Grid</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Breakfast, lunch, snacks, and dinner by day</p>
            </div>
            <Badge tone="green">{state.meals.length} meals</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[900px] p-6">
                <div className="grid grid-cols-[110px_repeat(4,minmax(150px,1fr))] gap-3">
                  <div />
                  {mealColumns.map((column) => (
                    <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400" key={column.key}>
                      {column.label}
                    </div>
                  ))}

                  {dayOrder.map((day) => (
                    <div className="contents" key={day}>
                      <div className="flex items-center justify-end pr-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {day.slice(0, 3)}
                      </div>
                      {mealColumns.map((column) => {
                        const meal = mealsByDay[day]?.find((item) => item.mealType === column.key)
                        const active = meal?.id === selectedMealId

                        if (!meal) {
                          return (
                            <div
                              className="grid min-h-[6rem] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-300"
                              key={`${day}-${column.key}`}
                            >
                              No plan
                            </div>
                          )
                        }

                        return (
                          <button
                            className={cn(
                              'grid min-h-[6rem] content-between rounded-2xl px-3 py-3 text-left text-white shadow-sm transition-all duration-300 hover:scale-[1.04] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500',
                              meal.colorClass,
                              active && 'ring-[3px] ring-white/50 shadow-xl scale-[1.06] z-10 relative',
                            )}
                            key={`${day}-${column.key}`}
                            onClick={() => selectMeal(meal)}
                            type="button"
                          >
                            <span className="line-clamp-2 text-[13px] font-bold leading-5">{meal.mealName}</span>
                            <span className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold text-white/80">
                              <span className="rounded-full bg-white/20 px-2 py-1">{meal.calories} cal</span>
                              <span className="rounded-full bg-white/20 px-2 py-1">{meal.prepTime}m</span>
                            </span>
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

        <aside className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Selected Meal</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Edit meal plan entry</p>
            </CardHeader>
            <CardContent>
              {selectedMeal ? (
                <form className="grid gap-3.5" onSubmit={handleSave}>
                  <fieldset className="m-0 grid gap-3.5 border-0 p-0" disabled={!canManageMeals}>
                    <Badge tone="indigo">
                      {selectedMeal.dayOfWeek} - {selectedMeal.mealType}
                    </Badge>
                    <FormField label="Meal name">
                      <textarea
                        className={cn(inputClass, 'min-h-24 resize-none')}
                        onChange={(event) => setDraftName(event.target.value)}
                        value={draftName}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50/80 p-3.5">
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Flame className="size-3.5 text-amber-500" aria-hidden="true" />
                          Calories
                        </p>
                        <p className="text-lg font-bold text-slate-900">{selectedMeal.calories}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3.5">
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Timer className="size-3.5 text-indigo-500" aria-hidden="true" />
                          Prep time
                        </p>
                        <p className="text-lg font-bold text-slate-900">{selectedMeal.prepTime}m</p>
                      </div>
                    </div>
                    {selectedMeal.dietaryFlags && selectedMeal.dietaryFlags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedMeal.dietaryFlags.map((flag) => (
                          <Badge key={flag} tone="teal">{flag}</Badge>
                        ))}
                      </div>
                    )}
                    {selectedRecipe && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{selectedRecipe.recipeName}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{selectedRecipe.description}</p>
                          </div>
                          <ChefHat className="size-5 text-emerald-600" aria-hidden="true" />
                        </div>
                      </div>
                    )}
                    <Button type="submit">
                      <Save className="size-4" aria-hidden="true" />
                      Save meal
                    </Button>
                  </fieldset>
                </form>
              ) : (
                <p className="text-sm text-slate-400">No meal selected.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recipe Library</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Reusable meals and substitutions</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recipes.map((recipe) => (
                <div
                  className={cn(
                    'hover-card rounded-xl border bg-slate-50/50 p-4',
                    selectedRecipe?.id === recipe.id ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100/80',
                  )}
                  key={recipe.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{recipe.recipeName}</p>
                      <p className="mt-1 text-xs text-slate-400">{recipe.description}</p>
                    </div>
                    <ChefHat className="size-5 text-emerald-500" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {recipe.dietaryTags.map((tag) => (
                      <Badge key={tag} tone="teal">{tag}</Badge>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1.5">
                      <Clock3 className="size-3.5 text-indigo-500" aria-hidden="true" />
                      {recipe.prepTime + recipe.cookTime}m
                    </span>
                    <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1.5">
                      <Gauge className="size-3.5 text-amber-500" aria-hidden="true" />
                      {recipe.difficulty}
                    </span>
                    <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1.5">
                      <ChefHat className="size-3.5 text-emerald-500" aria-hidden="true" />
                      {recipe.servings}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">
                  Page {Math.floor(page.offset / page.limit) + 1} - {recipes.length} loaded
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={page.offset === 0 || page.isLoading}
                    onClick={() => store.loadRecipePage(page.offset - page.limit)}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!page.hasNext || page.isLoading}
                    onClick={() => store.loadRecipePage(page.offset + page.limit)}
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Signals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-50/80 p-4">
                <p className="text-[11px] font-medium text-indigo-600">Average prep</p>
                <p className="text-xl font-bold text-slate-900">{mealStats.averagePrep}m</p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 p-4">
                <p className="text-[11px] font-medium text-emerald-600">Weekly calories</p>
                <p className="text-xl font-bold text-slate-900">{mealStats.weeklyCalories}</p>
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
            <CardContent className="flex items-center gap-2 text-xs text-slate-400">
              <BookOpen className="size-4" aria-hidden="true" />
              Screenshot meal names are seeded into the grid.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
