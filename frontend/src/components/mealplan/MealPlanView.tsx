import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, CalendarCheck2, ChefHat, ClipboardCheck, Clock3, Edit3, Flame, Gauge, Plus, Save, Timer, Trash2, Users } from 'lucide-react'
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
  const { state, updateMeal, applyWeeklyTemplate, addRecipe, updateRecipe, deleteRecipe, loadRecipePage, loadMemberMeals, memberMeals, memberMealsLoading } = store
  const canManageMeals = store.can('manage_meals')
  const canManageRecipes = store.can('manage_recipes')
  const page = store.pagination.recipes
  const recipes = store.paged.recipes ?? state.recipes
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [selectedMealId, setSelectedMealId] = useState<number>(state.meals[0]?.id ?? 0)
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [recipeDraft, setRecipeDraft] = useState({ recipeName: '', description: '', ingredients: '', prepTime: 10, cookTime: 15, servings: 4, difficulty: 'easy' as 'easy' | 'medium' | 'hard', cuisine: '', dietaryTags: '' })
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null)
  const [recipeEdit, setRecipeEdit] = useState({ recipeName: '', description: '', cuisine: '' })

  useEffect(() => {
    loadRecipePage(0)
  }, [loadRecipePage])

  useEffect(() => {
    loadMemberMeals(selectedMemberId)
  }, [selectedMemberId, loadMemberMeals])

  // Active meals: member-filtered or all family meals
  const activeMeals = selectedMemberId !== null && memberMeals ? memberMeals : state.meals
  const activeMealsByDay = useMemo(() => {
    return activeMeals.reduce<Record<string, MealPlanItem[]>>((acc, meal) => {
      acc[meal.dayOfWeek] = [...(acc[meal.dayOfWeek] ?? []), meal]
      return acc
    }, {})
  }, [activeMeals])

  const selectedMeal = activeMeals.find((meal) => meal.id === selectedMealId)
  const [draftName, setDraftName] = useState(selectedMeal?.mealName ?? '')

  const mealStats = useMemo(() => {
    const averagePrep = Math.round(
      activeMeals.reduce((total, meal) => total + meal.prepTime, 0) / Math.max(1, activeMeals.length),
    )
    const weeklyCalories = activeMeals.reduce((total, meal) => total + meal.calories, 0)
    const plannedSlots = activeMeals.length
    const coverage = Math.min(100, Math.round((plannedSlots / (dayOrder.length * mealColumns.length)) * 100))
    return { averagePrep, coverage, plannedSlots, weeklyCalories }
  }, [activeMeals])

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
        <div className="flex flex-wrap items-center gap-3">
          {/* Member selector */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Users className="size-4 text-slate-400" />
            <select
              className="bg-transparent text-sm font-medium text-slate-700 outline-none"
              value={selectedMemberId ?? ''}
              onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All members</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <Button
            disabled={!canManageMeals}
            onClick={() => {
              const target = selectedMemberId !== null ? state.members.find((m) => m.id === selectedMemberId)?.name : 'the family'
              if (window.confirm(`Apply the weekly meal template for ${target}?`)) {
                applyWeeklyTemplate(selectedMemberId)
              }
            }}
          >
            <ClipboardCheck className="size-4" aria-hidden="true" />
            Apply template{selectedMemberId !== null ? ` for ${state.members.find((m) => m.id === selectedMemberId)?.name ?? 'member'}` : ''}
          </Button>
        </div>
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
              <CardTitle>Week Grid{selectedMemberId !== null ? ` — ${state.members.find((m) => m.id === selectedMemberId)?.name ?? ''}` : ''}</CardTitle>
              <p className="mt-1 text-xs text-slate-400">{selectedMemberId !== null ? 'Personal meal plan' : 'Family-wide meals'}{memberMealsLoading ? ' · Loading...' : ''}</p>
            </div>
            <Badge tone="green">{activeMeals.length} meals</Badge>
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
                        const meal = activeMealsByDay[day]?.find((item) => item.mealType === column.key)
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
                              'grid min-h-[6.5rem] content-between rounded-2xl px-3.5 py-3.5 text-left text-white shadow-md transition-all duration-300 hover:scale-[1.05] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500',
                              meal.colorClass,
                              active && 'ring-[3px] ring-white/60 shadow-xl scale-[1.06] z-10 relative',
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
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Recipe Library</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Reusable meals and substitutions</p>
              </div>
              {canManageRecipes && (
                <Button variant="secondary" onClick={() => setShowAddRecipe(!showAddRecipe)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-3">
              {canManageRecipes && showAddRecipe && (
                <form
                  className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!recipeDraft.recipeName.trim()) return
                    addRecipe({
                      recipeName: recipeDraft.recipeName.trim(),
                      description: recipeDraft.description.trim(),
                      ingredients: recipeDraft.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
                      prepTime: recipeDraft.prepTime,
                      cookTime: recipeDraft.cookTime,
                      servings: recipeDraft.servings,
                      difficulty: recipeDraft.difficulty,
                      cuisine: recipeDraft.cuisine.trim(),
                      dietaryTags: recipeDraft.dietaryTags.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                    setRecipeDraft({ recipeName: '', description: '', ingredients: '', prepTime: 10, cookTime: 15, servings: 4, difficulty: 'easy', cuisine: '', dietaryTags: '' })
                    setShowAddRecipe(false)
                  }}
                >
                  <FormField label="Recipe name">
                    <input className={inputClass} value={recipeDraft.recipeName} onChange={(e) => setRecipeDraft((d) => ({ ...d, recipeName: e.target.value }))} placeholder="e.g. Veggie Stir Fry" />
                  </FormField>
                  <FormField label="Description">
                    <input className={inputClass} value={recipeDraft.description} onChange={(e) => setRecipeDraft((d) => ({ ...d, description: e.target.value }))} />
                  </FormField>
                  <FormField label="Ingredients (comma-separated)">
                    <input className={inputClass} value={recipeDraft.ingredients} onChange={(e) => setRecipeDraft((d) => ({ ...d, ingredients: e.target.value }))} placeholder="tofu, broccoli, soy sauce" />
                  </FormField>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField label="Prep (min)">
                      <input className={inputClass} type="number" value={recipeDraft.prepTime} onChange={(e) => setRecipeDraft((d) => ({ ...d, prepTime: Number(e.target.value) }))} />
                    </FormField>
                    <FormField label="Cook (min)">
                      <input className={inputClass} type="number" value={recipeDraft.cookTime} onChange={(e) => setRecipeDraft((d) => ({ ...d, cookTime: Number(e.target.value) }))} />
                    </FormField>
                    <FormField label="Servings">
                      <input className={inputClass} type="number" value={recipeDraft.servings} onChange={(e) => setRecipeDraft((d) => ({ ...d, servings: Number(e.target.value) }))} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Difficulty">
                      <select className={inputClass} value={recipeDraft.difficulty} onChange={(e) => setRecipeDraft((d) => ({ ...d, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </FormField>
                    <FormField label="Cuisine">
                      <input className={inputClass} value={recipeDraft.cuisine} onChange={(e) => setRecipeDraft((d) => ({ ...d, cuisine: e.target.value }))} placeholder="Italian" />
                    </FormField>
                  </div>
                  <FormField label="Tags (comma-separated)">
                    <input className={inputClass} value={recipeDraft.dietaryTags} onChange={(e) => setRecipeDraft((d) => ({ ...d, dietaryTags: e.target.value }))} placeholder="vegetarian, quick" />
                  </FormField>
                  <Button type="submit"><Plus className="size-4" aria-hidden="true" /> Add recipe</Button>
                </form>
              )}
              {recipes.map((recipe) => (
                <div
                  className={cn(
                    'hover-card rounded-xl border bg-slate-50/50 p-4',
                    selectedRecipe?.id === recipe.id ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100/80',
                  )}
                  key={recipe.id}
                >
                  {editingRecipeId === recipe.id ? (
                    <form
                      className="grid gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        updateRecipe(recipe.id, recipeEdit)
                        setEditingRecipeId(null)
                      }}
                    >
                      <input className={inputClass} value={recipeEdit.recipeName} onChange={(e) => setRecipeEdit((d) => ({ ...d, recipeName: e.target.value }))} />
                      <input className={inputClass} value={recipeEdit.description} onChange={(e) => setRecipeEdit((d) => ({ ...d, description: e.target.value }))} />
                      <input className={inputClass} value={recipeEdit.cuisine} onChange={(e) => setRecipeEdit((d) => ({ ...d, cuisine: e.target.value }))} placeholder="Cuisine" />
                      <div className="flex gap-2">
                        <Button type="submit">Save</Button>
                        <Button variant="secondary" onClick={() => setEditingRecipeId(null)} type="button">Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{recipe.recipeName}</p>
                          <p className="mt-1 text-xs text-slate-400">{recipe.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {canManageRecipes && (
                            <>
                              <button
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-indigo-600"
                                onClick={() => { setEditingRecipeId(recipe.id); setRecipeEdit({ recipeName: recipe.recipeName, description: recipe.description, cuisine: recipe.cuisine }) }}
                                title="Edit" type="button"
                              >
                                <Edit3 className="size-3.5" aria-hidden="true" />
                              </button>
                              <button
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                                onClick={() => { if (window.confirm(`Delete ${recipe.recipeName}?`)) deleteRecipe(recipe.id) }}
                                title="Delete" type="button"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          <ChefHat className="size-5 text-emerald-500" aria-hidden="true" />
                        </div>
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
                    </>
                  )}
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
