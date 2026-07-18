import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarCheck2, ChefHat, ClipboardCheck, Clock3, Edit3, Flame, Gauge, Plus, RefreshCw, Save, Timer, Trash2, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FridgeHubStore } from '@/hooks/useFridgeHub'
import { api } from '@/services/api'
import type { MealPlanItem, MealTemplateRow, MealTemplateRowInput, MealType, MealUpdateInput, TimeScope, WeekDay } from '@/types/familyHub'
import { formatCompactDate, formatDay, isIsoDateInRange, todayIso, weekEndIso, weekStartIso } from '@/utils/date'
import { cn } from '@/utils/style'

type MealPageTab = 'plan' | 'templates'
type TemplateApplyTarget = 'family' | 'all' | 'member'
type MealEffectiveScope = 'daily' | 'weekly' | 'monthly'
type MealAudience = 'family' | 'individual' | 'group'

interface MealDraft {
  mealName: string
  description: string
  calories: number
  prepTime: number
  audience: MealAudience
  audienceMemberId: string
  audienceMemberIds: string[]
  dietaryFlags: string
  recipeId: string
}

interface MealSlotGroup {
  date?: string
  day: string
  familyMeal?: MealPlanItem
  key: string
  mealType: MealType
  meals: MealPlanItem[]
  personalMeals: MealPlanItem[]
  visibleMeal?: MealPlanItem
}

const mealColumns: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayOptions: { key: WeekDay; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

const defaultTemplateName = 'Default Weekly Meal Plan'
const defaultMealDraft: MealDraft = {
  mealName: '',
  description: '',
  calories: 0,
  prepTime: 0,
  audience: 'family',
  audienceMemberId: '',
  audienceMemberIds: [],
  dietaryFlags: '',
  recipeId: '',
}

const defaultTemplateDraft = (): MealTemplateRowInput => ({
  templateName: defaultTemplateName,
  dayOfWeek: 'monday',
  mealType: 'breakfast',
  mealName: '',
  description: '',
  calories: 300,
  prepTime: 15,
  recipeId: null,
})

const scopeFromSearchParam = (value: string | null): TimeScope | null =>
  value === 'today' || value === 'week' ? value : null

const mealSlotKey = (day: string, mealType: MealType) => `${day}:${mealType}`

const memberIdsFromMealScope = (scope?: string | null, assignedTo?: number | null) => {
  if (assignedTo) return [assignedTo]
  if (!scope || scope === 'family') return []
  if (scope.startsWith('user:')) {
    const memberId = Number(scope.slice('user:'.length))
    return Number.isFinite(memberId) ? [memberId] : []
  }
  if (scope.startsWith('group:')) {
    return scope
      .slice('group:'.length)
      .split(',')
      .map((value) => Number(value))
      .filter((value, index, values) => Number.isFinite(value) && values.indexOf(value) === index)
  }
  return []
}

const targetMemberIdsForMeal = (meal: MealPlanItem) =>
  meal.targetMemberIds?.length ? meal.targetMemberIds : memberIdsFromMealScope(meal.mealPlanScope, meal.assignedTo)

const audienceFromMemberIds = (memberIds: number[]): MealAudience => {
  if (memberIds.length === 0) return 'family'
  if (memberIds.length === 1) return 'individual'
  return 'group'
}

const isFamilyMeal = (meal: MealPlanItem) => targetMemberIdsForMeal(meal).length === 0

const mealAppliesToMember = (meal: MealPlanItem, memberId: number) => targetMemberIdsForMeal(meal).includes(memberId)

const mealAudienceLabel = (meal: MealPlanItem, members: { id: number; name: string }[]) => {
  const memberIds = targetMemberIdsForMeal(meal)
  if (memberIds.length === 0) return 'All family'
  const names = memberIds.map((memberId) => members.find((member) => member.id === memberId)?.name ?? `Member ${memberId}`)
  if (names.length === 1) return names[0]
  return `Group: ${names.join(', ')}`
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

const monthEndIso = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

const defaultEffectiveUntil = (planDate: string, scope: MealEffectiveScope) => {
  if (scope === 'weekly') return weekEndIso(planDate)
  if (scope === 'monthly') return monthEndIso(planDate)
  return planDate
}

export const MealPlanView = ({ store }: { store: FridgeHubStore }) => {
  const { state, updateMeal, applyWeeklyTemplate, applyWeeklyTemplateForAll, addRecipe, updateRecipe, deleteRecipe, loadRecipePage, loadMemberMeals, memberMeals, memberMealsLoading } = store
  const canManageMeals = store.can('manage_meals')
  const canManageRecipes = store.can('manage_recipes')
  const page = store.pagination.recipes
  const recipes = store.paged.recipes ?? state.recipes
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<MealPageTab>('plan')
  const [mealScope, setMealScope] = useState<TimeScope>(() => scopeFromSearchParam(searchParams.get('scope')) ?? 'week')
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [selectedMealId, setSelectedMealId] = useState<number | null>(state.meals[0]?.id ?? null)
  const [templates, setTemplates] = useState<MealTemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateName, setSelectedTemplateName] = useState(defaultTemplateName)
  const [templateTarget, setTemplateTarget] = useState<TemplateApplyTarget>('family')
  const [templateMemberId, setTemplateMemberId] = useState<string>(() => String(state.members[0]?.id ?? ''))
  const [templateDraft, setTemplateDraft] = useState<MealTemplateRowInput>(defaultTemplateDraft)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [detailSlotKey, setDetailSlotKey] = useState<string | null>(null)
  const [detailSlotData, setDetailSlotData] = useState<MealSlotGroup | null>(null)
  const [mealDraft, setMealDraft] = useState(defaultMealDraft)
  const [mealEffectiveScope, setMealEffectiveScope] = useState<MealEffectiveScope>('daily')
  const [mealEffectiveUntil, setMealEffectiveUntil] = useState('')
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [recipeDraft, setRecipeDraft] = useState({ recipeName: '', description: '', ingredients: '', prepTime: 10, cookTime: 15, servings: 4, difficulty: 'easy' as 'easy' | 'medium' | 'hard', cuisine: '', dietaryTags: '' })
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null)
  const [recipeEdit, setRecipeEdit] = useState({ recipeName: '', description: '', cuisine: '' })

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true)
    api
      .listMealTemplates()
      .then((rows) => {
        setTemplates(rows)
        if (rows.length > 0) {
          setSelectedTemplateName((current) => (rows.some((row) => row.templateName === current) ? current : rows[0].templateName))
          setTemplateDraft((current) => ({
            ...current,
            templateName: rows.some((row) => row.templateName === current.templateName) ? current.templateName : rows[0].templateName,
          }))
        }
      })
      .catch((error: unknown) => setTemplateFeedback(error instanceof Error ? error.message : 'Unable to load meal templates'))
      .finally(() => setTemplatesLoading(false))
  }, [])

  useEffect(() => {
    loadRecipePage(0)
  }, [loadRecipePage])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!templateMemberId && state.members.length > 0) {
      setTemplateMemberId(String(state.members[0].id))
    }
    if (templateMemberId && !state.members.some((member) => String(member.id) === templateMemberId)) {
      setTemplateMemberId(String(state.members[0]?.id ?? ''))
    }
  }, [state.members, templateMemberId])

  useEffect(() => {
    loadMemberMeals(selectedMemberId)
  }, [selectedMemberId, loadMemberMeals])

  useEffect(() => {
    const nextScope = scopeFromSearchParam(searchParams.get('scope')) ?? 'week'
    if (nextScope !== mealScope) {
      setMealScope(nextScope)
    }
    if (searchParams.has('scope')) {
      setActiveTab('plan')
    }
  }, [mealScope, searchParams])

  const updateMealScope = (nextScope: TimeScope) => {
    setMealScope(nextScope)
    setActiveTab('plan')
    const params = new URLSearchParams(searchParams)
    params.set('scope', nextScope)
    setSearchParams(params, { replace: true })
  }

  const mealScopeRange = useMemo(() => {
    const familyToday = todayIso(state.family.timezone)
    if (mealScope === 'today') {
      return {
        endIso: familyToday,
        startIso: familyToday,
      }
    }
    return {
      endIso: weekEndIso(familyToday),
      startIso: weekStartIso(familyToday),
    }
  }, [mealScope, state.family.timezone])

  const familyMeals = useMemo(
    () => state.meals.filter((meal) => isFamilyMeal(meal)),
    [state.meals],
  )

  const selectedMemberMeals = useMemo(() => {
    if (selectedMemberId === null) return []
    const sourceMeals = memberMeals ?? state.meals
    return sourceMeals.filter((meal) => !isFamilyMeal(meal) && mealAppliesToMember(meal, selectedMemberId))
  }, [memberMeals, selectedMemberId, state.meals])

  const activeMeals = useMemo(() => {
    if (selectedMemberId === null) return state.meals
    const personalKeys = new Set(selectedMemberMeals.map((meal) => mealSlotKey(meal.dayOfWeek, meal.mealType)))
    return [
      ...familyMeals.filter((meal) => !personalKeys.has(mealSlotKey(meal.dayOfWeek, meal.mealType))),
      ...selectedMemberMeals,
    ]
  }, [familyMeals, selectedMemberId, selectedMemberMeals, state.meals])

  const scopedMeals = useMemo(
    () => activeMeals.filter((meal) => isIsoDateInRange(meal.planDate, mealScopeRange.startIso, mealScopeRange.endIso)),
    [activeMeals, mealScopeRange],
  )

  const visibleDayOrder = useMemo(
    () => (mealScope === 'today' ? [formatDay(todayIso(state.family.timezone))] : dayOrder),
    [mealScope, state.family.timezone],
  )

  useEffect(() => {
    if (scopedMeals.length > 0 && (selectedMealId === null || !scopedMeals.some((meal) => meal.id === selectedMealId))) {
      setSelectedMealId(scopedMeals[0].id)
    } else if (scopedMeals.length === 0 && selectedMealId !== null) {
      setSelectedMealId(null)
    }
  }, [scopedMeals, selectedMealId])

  const mealSlotGroups = useMemo<MealSlotGroup[]>(() => {
    return visibleDayOrder.flatMap((day) =>
      mealColumns.map((column) => {
        const meals = scopedMeals.filter((meal) => meal.dayOfWeek === day && meal.mealType === column.key)
        const familyMeal = meals.find(isFamilyMeal)
        const personalMeals = meals.filter((meal) => !isFamilyMeal(meal))
        const selectedMemberMeal = selectedMemberId === null
          ? undefined
          : personalMeals.find((meal) => mealAppliesToMember(meal, selectedMemberId))
        return {
          date: meals[0]?.planDate,
          day,
          familyMeal,
          key: mealSlotKey(day, column.key),
          mealType: column.key,
          meals,
          personalMeals,
          visibleMeal: selectedMemberMeal ?? familyMeal ?? personalMeals[0],
        }
      }),
    )
  }, [scopedMeals, selectedMemberId, visibleDayOrder])

  const mealSlotByKey = useMemo(
    () => new Map(mealSlotGroups.map((slot) => [slot.key, slot])),
    [mealSlotGroups],
  )

  const selectedMeal = scopedMeals.find((meal) => meal.id === selectedMealId)
  const detailSlot = detailSlotKey ? (mealSlotGroups.find((slot) => slot.key === detailSlotKey) ?? detailSlotData) : undefined
  const templateNames = useMemo(() => {
    const names = Array.from(new Set(templates.map((row) => row.templateName))).sort((a, b) => a.localeCompare(b))
    return names.length > 0 ? names : [defaultTemplateName]
  }, [templates])
  const filteredTemplates = useMemo(
    () => templates.filter((row) => row.templateName === selectedTemplateName),
    [selectedTemplateName, templates],
  )
  const templateRowBySlot = useMemo(
    () => new Map(filteredTemplates.map((row) => [mealSlotKey(dayOptions.find((day) => day.key === row.dayOfWeek)?.label ?? row.dayOfWeek, row.mealType), row])),
    [filteredTemplates],
  )

  const mealStats = useMemo(() => {
    const averagePrep = Math.round(
      scopedMeals.reduce((total, meal) => total + meal.prepTime, 0) / Math.max(1, scopedMeals.length),
    )
    const weeklyCalories = scopedMeals.reduce((total, meal) => total + meal.calories, 0)
    const plannedSlots = scopedMeals.length
    const coverage = Math.min(100, Math.round((plannedSlots / (visibleDayOrder.length * mealColumns.length)) * 100))
    return { averagePrep, coverage, plannedSlots, weeklyCalories }
  }, [scopedMeals, visibleDayOrder.length])

  const selectedRecipe = selectedMeal?.recipeId
    ? state.recipes.find((recipe) => recipe.id === selectedMeal.recipeId)
    : undefined

  useEffect(() => {
    if (!selectedMeal) {
      setMealDraft(defaultMealDraft)
      setMealEffectiveScope('daily')
      setMealEffectiveUntil('')
      return
    }
    const targetMemberIds = targetMemberIdsForMeal(selectedMeal)
    const firstMemberId = String(targetMemberIds[0] ?? state.members[0]?.id ?? '')
    setMealDraft({
      mealName: selectedMeal.mealName,
      description: selectedMeal.description,
      calories: selectedMeal.calories,
      prepTime: selectedMeal.prepTime,
      audience: audienceFromMemberIds(targetMemberIds),
      audienceMemberId: firstMemberId,
      audienceMemberIds: targetMemberIds.map(String),
      dietaryFlags: (selectedMeal.dietaryFlags ?? []).join(', '),
      recipeId: selectedMeal.recipeId ? String(selectedMeal.recipeId) : '',
    })
    setMealEffectiveScope('daily')
    setMealEffectiveUntil(selectedMeal.planDate)
  }, [selectedMeal, state.members])

  const updateMealEffectiveScope = (scope: MealEffectiveScope) => {
    setMealEffectiveScope(scope)
    if (selectedMeal) {
      setMealEffectiveUntil(defaultEffectiveUntil(selectedMeal.planDate, scope))
    }
  }

  const updateMealAudience = (audience: MealAudience) => {
    setMealDraft((current) => {
      const fallbackMemberId = current.audienceMemberId || current.audienceMemberIds[0] || String(state.members[0]?.id ?? '')
      return {
        ...current,
        audience,
        audienceMemberId: audience === 'individual' ? fallbackMemberId : current.audienceMemberId,
        audienceMemberIds: audience === 'group'
          ? (current.audienceMemberIds.length > 0 ? current.audienceMemberIds : (fallbackMemberId ? [fallbackMemberId] : []))
          : current.audienceMemberIds,
      }
    })
  }

  const toggleMealAudienceMember = (memberId: number) => {
    const value = String(memberId)
    setMealDraft((current) => ({
      ...current,
      audienceMemberIds: current.audienceMemberIds.includes(value)
        ? current.audienceMemberIds.filter((id) => id !== value)
        : [...current.audienceMemberIds, value],
    }))
  }

  const mealDraftTargetMemberIds = () => {
    if (mealDraft.audience === 'family') return []
    const ids = mealDraft.audience === 'individual'
      ? [mealDraft.audienceMemberId]
      : mealDraft.audienceMemberIds
    return ids
      .map((value) => Number(value))
      .filter((value, index, values) => Number.isFinite(value) && values.indexOf(value) === index)
      .sort((a, b) => a - b)
  }

  const renderAudienceControls = () => (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Meal audience">
          <select
            className={inputClass}
            onChange={(event) => updateMealAudience(event.target.value as MealAudience)}
            value={mealDraft.audience}
          >
            <option value="family">All family members</option>
            <option value="individual">One family member</option>
            <option value="group">Selected members</option>
          </select>
        </FormField>
        {mealDraft.audience === 'individual' && (
          <FormField label="Family member">
            <select
              className={inputClass}
              onChange={(event) => setMealDraft((current) => ({ ...current, audienceMemberId: event.target.value }))}
              value={mealDraft.audienceMemberId}
            >
              {state.members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </FormField>
        )}
      </div>
      {mealDraft.audience === 'group' && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected members</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Selected meal members">
            {state.members.map((member) => {
              const selected = mealDraft.audienceMemberIds.includes(String(member.id))
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    selected
                      ? 'border-indigo-200 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50',
                  )}
                  key={member.id}
                  onClick={() => toggleMealAudienceMember(member.id)}
                  type="button"
                >
                  {member.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const openMealDetails = (slot: MealSlotGroup) => {
    const meal = slot.visibleMeal ?? slot.familyMeal ?? slot.meals[0]
    if (!meal) return
    setSelectedMealId(meal.id)
    setDetailSlotData(slot)
    setDetailSlotKey(slot.key)
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (selectedMeal && mealDraft.mealName.trim()) {
      const targetMemberIds = mealDraftTargetMemberIds()
      if (mealDraft.audience !== 'family' && targetMemberIds.length === 0) {
        return
      }
      const payload: MealUpdateInput = {
        mealName: mealDraft.mealName.trim(),
        description: mealDraft.description.trim(),
        calories: Math.max(0, Number(mealDraft.calories) || 0),
        prepTime: Math.max(0, Number(mealDraft.prepTime) || 0),
        assignedTo: targetMemberIds.length === 1 ? targetMemberIds[0] : null,
        targetMemberIds,
        dietaryFlags: mealDraft.dietaryFlags.split(',').map((flag) => flag.trim()).filter(Boolean),
        recipeId: mealDraft.recipeId ? Number(mealDraft.recipeId) : null,
        effectiveScope: mealEffectiveScope,
        effectiveUntil: mealEffectiveUntil || selectedMeal.planDate,
      }
      updateMeal(selectedMeal.id, payload)
      setDetailSlotKey(null)
      setDetailSlotData(null)
    }
  }

  const resetTemplateForm = (templateName = selectedTemplateName) => {
    setEditingTemplateId(null)
    setTemplateDraft({ ...defaultTemplateDraft(), templateName })
  }

  const handleTemplateSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageMeals || !templateDraft.mealName.trim() || !templateDraft.templateName.trim()) {
      return
    }
    const payload: MealTemplateRowInput = {
      ...templateDraft,
      templateName: templateDraft.templateName.trim(),
      mealName: templateDraft.mealName.trim(),
      description: templateDraft.description?.trim() ?? '',
      calories: Math.max(0, Number(templateDraft.calories) || 0),
      prepTime: Math.max(0, Number(templateDraft.prepTime) || 0),
      recipeId: templateDraft.recipeId || null,
    }
    const request = editingTemplateId
      ? api.updateMealTemplateRow(editingTemplateId, payload)
      : api.createMealTemplateRow(payload)
    request
      .then((row) => {
        setTemplateFeedback(editingTemplateId ? 'Template row updated' : 'Template row saved')
        setSelectedTemplateName(row.templateName)
        resetTemplateForm(row.templateName)
        loadTemplates()
      })
      .catch((error: unknown) => setTemplateFeedback(error instanceof Error ? error.message : 'Template row save failed'))
  }

  const editTemplateRow = (row: MealTemplateRow) => {
    setEditingTemplateId(row.id)
    setTemplateDraft({
      templateName: row.templateName,
      dayOfWeek: row.dayOfWeek,
      mealType: row.mealType,
      mealName: row.mealName,
      description: row.description,
      calories: row.calories,
      prepTime: row.prepTime,
      recipeId: row.recipeId ?? null,
    })
  }

  const deleteTemplateRow = (row: MealTemplateRow) => {
    if (!row.isEditable || !window.confirm(`Delete ${row.dayOfWeek} ${row.mealType} from ${row.templateName}?`)) {
      return
    }
    api
      .deleteMealTemplateRow(row.id)
      .then(() => {
        setTemplateFeedback('Template row deleted')
        if (editingTemplateId === row.id) resetTemplateForm(row.templateName)
        loadTemplates()
      })
      .catch((error: unknown) => setTemplateFeedback(error instanceof Error ? error.message : 'Template row delete failed'))
  }

  const templateTargetLabel = useMemo(() => {
    if (templateTarget === 'all') return 'all family members'
    if (templateTarget === 'member') {
      return state.members.find((member) => String(member.id) === templateMemberId)?.name ?? 'selected member'
    }
    return 'the shared family plan'
  }, [state.members, templateMemberId, templateTarget])

  const applyTemplateToTarget = async () => {
    if (templateTarget === 'member' && !templateMemberId) {
      setTemplateFeedback('Choose a family member before applying this template.')
      return
    }
    setIsApplyingTemplate(true)
    setTemplateFeedback(`Applying ${selectedTemplateName} to ${templateTargetLabel}...`)
    try {
      if (templateTarget === 'all') {
        await applyWeeklyTemplateForAll(selectedTemplateName)
        setSelectedMemberId(null)
      } else if (templateTarget === 'member') {
        const memberId = Number(templateMemberId)
        await applyWeeklyTemplate(memberId, selectedTemplateName)
        setSelectedMemberId(memberId)
        loadMemberMeals(memberId)
      } else {
        await applyWeeklyTemplate(null, selectedTemplateName)
        setSelectedMemberId(null)
      }
      setMealScope('week')
      const params = new URLSearchParams(searchParams)
      params.set('scope', 'week')
      setSearchParams(params, { replace: true })
      setActiveTab('plan')
      setDetailSlotKey(null)
      setDetailSlotData(null)
      setTemplateFeedback(`Applied ${selectedTemplateName} to ${templateTargetLabel}.`)
    } catch (error) {
      setTemplateFeedback(error instanceof Error ? error.message : 'Unable to apply meal template')
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Weekly Meal Plan</h2>
          <p className="mt-1 text-sm text-slate-400">Meals, member plans, and weekly templates</p>
        </div>
        {activeTab === 'plan' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {[
                { value: 'today' as const, label: 'Today' },
                { value: 'week' as const, label: 'This week' },
              ].map((option) => (
                <button
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-xs font-bold transition',
                    mealScope === option.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                  )}
                  key={option.value}
                  onClick={() => updateMealScope(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
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
	            <Button className="min-h-10 px-3 py-2 text-xs" onClick={() => setActiveTab('templates')} variant="outline">
	              <ClipboardCheck className="size-4" aria-hidden="true" />
	              Apply template
	            </Button>
	          </div>
	        )}
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {[
          { key: 'plan' as const, label: 'Current Plan' },
          { key: 'templates' as const, label: 'Weekly Templates' },
        ].map((tab) => (
          <button
            className={cn(
              'min-h-10 rounded-lg px-4 text-sm font-semibold transition',
              activeTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
            )}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plan' && (
        <>
      <Card variant="accent" className="overflow-hidden">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4">
            <Badge className="border-white/20 bg-white/15 text-white" icon={<CalendarCheck2 className="size-3.5" aria-hidden="true" />} mode="pill">
              {mealScope === 'today' ? 'Daily coverage' : 'Weekly coverage'}
            </Badge>
            <div>
              <h3 className="text-2xl font-bold text-white">
                {mealScope === 'today'
                  ? 'Today meals, prep time, and nutrition are visible in one row.'
                  : 'Meals, prep time, and nutrition are visible before the week starts.'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                The grid keeps the selected scope scannable while the side panel exposes the selected meal and matching recipe.
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
              <CardTitle>{mealScope === 'today' ? 'Today Grid' : 'Week Grid'}{selectedMemberId !== null ? ` — ${state.members.find((m) => m.id === selectedMemberId)?.name ?? ''}` : ''}</CardTitle>
              <p className="mt-1 text-xs text-slate-400">{selectedMemberId !== null ? 'Personal meal plan' : 'Family-wide meals'}{memberMealsLoading ? ' · Loading...' : ''}</p>
            </div>
            <Badge tone="green">{scopedMeals.length} meals</Badge>
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

                  {visibleDayOrder.map((day) => (
                    <div className="contents" key={day}>
                      <div className="flex items-center justify-end pr-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {day.slice(0, 3)}
                      </div>
                      {mealColumns.map((column) => {
                        const slot = mealSlotByKey.get(mealSlotKey(day, column.key))
                        const meal = slot?.visibleMeal
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
                            aria-label={`Open ${meal.mealName} ${day} ${column.label} details`}
                            className={cn(
                              'grid min-h-[6.5rem] content-between rounded-2xl px-3.5 py-3.5 text-left text-white shadow-md transition-all duration-300 hover:scale-[1.05] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500',
                              meal.colorClass,
                              active && 'ring-[3px] ring-white/60 shadow-xl scale-[1.06] z-10 relative',
                            )}
                            key={`${day}-${column.key}`}
                            onClick={() => slot && openMealDetails(slot)}
                            type="button"
                          >
                            <span className="line-clamp-2 text-[13px] font-bold leading-5">{meal.mealName}</span>
                            <span className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold text-white/80">
                              <span className="rounded-full bg-white/20 px-2 py-1">{mealAudienceLabel(meal, state.members)}</span>
                              {slot && slot.personalMeals.length > 0 && selectedMemberId === null && (
                                <span className="rounded-full bg-white/20 px-2 py-1">{slot.personalMeals.length} scoped</span>
                              )}
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
                    <div className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-600">Effective date</span>
                        <span>{formatCompactDate(selectedMeal.planDate)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-600">Updated</span>
                        <span>{formatDateTime(selectedMeal.updatedAt)}</span>
                      </div>
                    </div>
                    <FormField label="Meal name">
                      <textarea
                        className={cn(inputClass, 'min-h-24 resize-none')}
                        onChange={(event) => setMealDraft((current) => ({ ...current, mealName: event.target.value }))}
                        value={mealDraft.mealName}
                      />
                    </FormField>
                    <FormField label="Description">
                      <textarea
                        className={cn(inputClass, 'min-h-20 resize-none')}
                        onChange={(event) => setMealDraft((current) => ({ ...current, description: event.target.value }))}
                        value={mealDraft.description}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Calories">
                        <div className="relative">
                          <Flame className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-amber-500" aria-hidden="true" />
                          <input
                            className={cn(inputClass, 'pl-8')}
                            min={0}
                            onChange={(event) => setMealDraft((current) => ({ ...current, calories: Number(event.target.value) }))}
                            type="number"
                            value={mealDraft.calories}
                          />
                        </div>
                      </FormField>
                      <FormField label="Prep time">
                        <div className="relative">
                          <Timer className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-indigo-500" aria-hidden="true" />
                          <input
                            className={cn(inputClass, 'pl-8')}
                            min={0}
                            onChange={(event) => setMealDraft((current) => ({ ...current, prepTime: Number(event.target.value) }))}
                            type="number"
                            value={mealDraft.prepTime}
                          />
                        </div>
                      </FormField>
                    </div>
                    {renderAudienceControls()}
                    <FormField label="Recipe">
                      <select
                        className={inputClass}
                        onChange={(event) => setMealDraft((current) => ({ ...current, recipeId: event.target.value }))}
                        value={mealDraft.recipeId}
                      >
                        <option value="">No recipe</option>
                        {state.recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>{recipe.recipeName}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Dietary flags">
                      <input
                        className={inputClass}
                        onChange={(event) => setMealDraft((current) => ({ ...current, dietaryFlags: event.target.value }))}
                        placeholder="vegetarian, low-sugar"
                        value={mealDraft.dietaryFlags}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Change scope">
                        <select
                          className={inputClass}
                          onChange={(event) => updateMealEffectiveScope(event.target.value as MealEffectiveScope)}
                          value={mealEffectiveScope}
                        >
                          <option value="daily">Daily until date</option>
                          <option value="weekly">Weekly same day</option>
                          <option value="monthly">Monthly same date</option>
                        </select>
                      </FormField>
                      <FormField label="Effective until">
                        <input
                          className={inputClass}
                          min={selectedMeal.planDate}
                          onChange={(event) => setMealEffectiveUntil(event.target.value)}
                          type="date"
                          value={mealEffectiveUntil || selectedMeal.planDate}
                        />
                      </FormField>
                    </div>
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
              <CardTitle>{mealScope === 'today' ? 'Daily Signals' : 'Weekly Signals'}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-50/80 p-4">
                <p className="text-[11px] font-medium text-indigo-600">Average prep</p>
                <p className="text-xl font-bold text-slate-900">{mealStats.averagePrep}m</p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 p-4">
                <p className="text-[11px] font-medium text-emerald-600">{mealScope === 'today' ? 'Daily calories' : 'Weekly calories'}</p>
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
        </>
      )}

      {activeTab === 'templates' && (
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Apply Weekly Template</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Choose a named template and where it should be applied.</p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.3fr)_auto] lg:items-end">
              <FormField label="Template">
                <select
                  className={inputClass}
                  value={selectedTemplateName}
                  onChange={(event) => {
                    setSelectedTemplateName(event.target.value)
                    setTemplateDraft((current) => ({ ...current, templateName: event.target.value }))
                  }}
                >
                  {templateNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </FormField>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <FormField label="Apply to">
                  <select
                    className={inputClass}
                    value={templateTarget}
                    onChange={(event) => setTemplateTarget(event.target.value as TemplateApplyTarget)}
                  >
                    <option value="family">Shared family plan</option>
                    <option value="member">One family member</option>
                    <option value="all">All active members</option>
                  </select>
                </FormField>
                <FormField label="Family member" className={templateTarget === 'member' ? '' : 'opacity-60'}>
                  <select
                    className={inputClass}
                    disabled={templateTarget !== 'member'}
                    value={templateMemberId}
                    onChange={(event) => setTemplateMemberId(event.target.value)}
                  >
                    {state.members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <Button disabled={!canManageMeals || isApplyingTemplate} onClick={applyTemplateToTarget}>
                <ClipboardCheck className="size-4" aria-hidden="true" />
                {isApplyingTemplate ? 'Applying...' : 'Apply template'}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Template Week Grid</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Preview of breakfast, lunch, snacks, and dinner before applying.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[110px_repeat(4,minmax(150px,1fr))] gap-3">
                    <div />
                    {mealColumns.map((column) => (
                      <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400" key={column.key}>
                        {column.label}
                      </div>
                    ))}
                    {dayOptions.map((day) => (
                      <div className="contents" key={day.key}>
                        <div className="flex items-center justify-end pr-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                          {day.label.slice(0, 3)}
                        </div>
                        {mealColumns.map((column) => {
                          const row = templateRowBySlot.get(mealSlotKey(day.label, column.key))
                          return row ? (
                            <div
                              className="grid min-h-[6.5rem] content-between rounded-2xl border border-indigo-100 bg-indigo-50 px-3.5 py-3.5 text-left"
                              key={`${day.key}-${column.key}`}
                            >
                              <span className="line-clamp-2 text-[13px] font-bold leading-5 text-slate-900">{row.mealName}</span>
                              <span className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold text-indigo-700">
                                <span className="rounded-full bg-white px-2 py-1">{row.calories} cal</span>
                                <span className="rounded-full bg-white px-2 py-1">{row.prepTime}m</span>
                                <span className="rounded-full bg-white px-2 py-1">{row.isGlobal ? 'Global' : 'Family'}</span>
                              </span>
                            </div>
                          ) : (
                            <div
                              className="grid min-h-[6rem] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-300"
                              key={`${day.key}-${column.key}`}
                            >
                              No template
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Weekly Template</CardTitle>
            <p className="mt-1 text-xs text-slate-400">{filteredTemplates.length} rows in {selectedTemplateName}{templatesLoading ? ' - Loading...' : ''}</p>
          </div>
          <Button onClick={loadTemplates} type="button" variant="secondary">
            <RefreshCw className={cn('size-4', templatesLoading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-5">
          {templateFeedback && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
              {templateFeedback}
            </div>
          )}

          <form className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4" data-testid="meal-template-form" onSubmit={handleTemplateSave}>
            <fieldset className="m-0 grid gap-3 border-0 p-0" disabled={!canManageMeals}>
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.5fr]">
                <FormField label="Template">
                  <input
                    className={inputClass}
                    list="meal-template-names"
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, templateName: event.target.value }))}
                    value={templateDraft.templateName}
                  />
                  <datalist id="meal-template-names">
                    {templateNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </FormField>
                <FormField label="Day">
                  <select
                    className={inputClass}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, dayOfWeek: event.target.value as WeekDay }))}
                    value={templateDraft.dayOfWeek}
                  >
                    {dayOptions.map((day) => (
                      <option key={day.key} value={day.key}>{day.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Meal type">
                  <select
                    className={inputClass}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, mealType: event.target.value as MealType }))}
                    value={templateDraft.mealType}
                  >
                    {mealColumns.map((mealType) => (
                      <option key={mealType.key} value={mealType.key}>{mealType.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Meal name">
                  <input
                    className={inputClass}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, mealName: event.target.value }))}
                    value={templateDraft.mealName}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_2fr_auto]">
                <FormField label="Calories">
                  <input
                    className={inputClass}
                    min={0}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, calories: Number(event.target.value) }))}
                    type="number"
                    value={templateDraft.calories ?? 0}
                  />
                </FormField>
                <FormField label="Prep time">
                  <input
                    className={inputClass}
                    min={0}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, prepTime: Number(event.target.value) }))}
                    type="number"
                    value={templateDraft.prepTime ?? 0}
                  />
                </FormField>
                <FormField label="Recipe">
                  <select
                    className={inputClass}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, recipeId: event.target.value ? Number(event.target.value) : null }))}
                    value={templateDraft.recipeId ?? ''}
                  >
                    <option value="">No recipe</option>
                    {state.recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>{recipe.recipeName}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Description">
                  <input
                    className={inputClass}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))}
                    value={templateDraft.description ?? ''}
                  />
                </FormField>
                <div className="flex items-end gap-2">
                  <Button type="submit">
                    <Save className="size-4" aria-hidden="true" />
                    {editingTemplateId ? 'Update' : 'Add'}
                  </Button>
                  {editingTemplateId && (
                    <Button onClick={() => resetTemplateForm()} type="button" variant="secondary">
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </fieldset>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Meal</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Calories</th>
                  <th className="px-4 py-3">Prep</th>
                  <th className="px-4 py-3">Recipe</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTemplates.map((row) => {
                  const recipe = row.recipeId ? state.recipes.find((item) => item.id === row.recipeId) : undefined
                  const dayLabel = dayOptions.find((day) => day.key === row.dayOfWeek)?.label ?? row.dayOfWeek
                  const mealLabel = mealColumns.find((mealType) => mealType.key === row.mealType)?.label ?? row.mealType
                  return (
                    <tr className="transition-colors hover:bg-slate-50/60" key={row.id}>
                      <td className="px-4 py-3 font-semibold text-slate-700">{dayLabel}</td>
                      <td className="px-4 py-3 text-slate-500">{mealLabel}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.mealName}</p>
                        {row.description && <p className="mt-1 max-w-md truncate text-xs text-slate-400">{row.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.calories}</td>
                      <td className="px-4 py-3 text-slate-500">{row.prepTime}m</td>
                      <td className="px-4 py-3 text-slate-500">{recipe?.recipeName ?? 'None'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={row.isGlobal ? 'amber' : 'green'}>{row.isGlobal ? 'Global' : 'Family'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!row.isEditable || !canManageMeals}
                            onClick={() => editTemplateRow(row)}
                            title="Edit template row"
                            type="button"
                          >
                            <Edit3 className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!row.isEditable || !canManageMeals}
                            onClick={() => deleteTemplateRow(row)}
                            title="Delete template row"
                            type="button"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={8}>
                      No rows for this template.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </div>
      )}

      {detailSlot && (
        <div
          className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-md"
          onClick={() => { setDetailSlotKey(null); setDetailSlotData(null) }}
        >
          <section
            aria-modal="true"
            className="animate-scale-in modal-max-h w-full max-w-3xl overflow-auto rounded-3xl border border-slate-200/80 bg-white shadow-[0_32px_80px_rgb(15_23_42/0.18)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="relative overflow-hidden border-b border-slate-100 px-6 py-5">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-amber-50/60" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
	                    <Badge tone="indigo">{detailSlot.day}</Badge>
	                    <Badge tone="green">{mealColumns.find((column) => column.key === detailSlot.mealType)?.label ?? detailSlot.mealType}</Badge>
	                    {detailSlot.visibleMeal && <Badge tone={isFamilyMeal(detailSlot.visibleMeal) ? 'slate' : 'indigo'}>{mealAudienceLabel(detailSlot.visibleMeal, state.members)}</Badge>}
	                    {detailSlot.date && <Badge tone="slate">Effective {formatCompactDate(detailSlot.date)}</Badge>}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold text-slate-950">
                    {detailSlot.visibleMeal?.mealName ?? 'Meal details'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
	                    {detailSlot.personalMeals.length > 0
	                      ? `${detailSlot.personalMeals.length} scoped variation${detailSlot.personalMeals.length === 1 ? '' : 's'}`
	                      : 'Shared family plan'}
                  </p>
                </div>
                <button
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => { setDetailSlotKey(null); setDetailSlotData(null) }}
                  type="button"
                >
                  <span className="sr-only">Close meal details</span>
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid gap-5 px-6 py-6">
              {selectedMeal && (
                <form className="grid gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 p-5 shadow-sm" onSubmit={handleSave}>
                  <fieldset className="m-0 grid gap-3 border-0 p-0" disabled={!canManageMeals}>
                    <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr]">
                      <FormField label="Meal name">
                        <input
                          className={inputClass}
                          onChange={(event) => setMealDraft((current) => ({ ...current, mealName: event.target.value }))}
                          value={mealDraft.mealName}
                        />
                      </FormField>
                      <FormField label="Calories">
                        <input
                          className={inputClass}
                          min={0}
                          onChange={(event) => setMealDraft((current) => ({ ...current, calories: Number(event.target.value) }))}
                          type="number"
                          value={mealDraft.calories}
                        />
                      </FormField>
                      <FormField label="Prep time">
                        <input
                          className={inputClass}
                          min={0}
                          onChange={(event) => setMealDraft((current) => ({ ...current, prepTime: Number(event.target.value) }))}
                          type="number"
                          value={mealDraft.prepTime}
                        />
                      </FormField>
                    </div>
                    <FormField label="Description">
                      <textarea
                        className={cn(inputClass, 'min-h-20 resize-y')}
                        onChange={(event) => setMealDraft((current) => ({ ...current, description: event.target.value }))}
                        value={mealDraft.description}
                      />
                    </FormField>
                    {renderAudienceControls()}
                    <FormField label="Recipe">
                      <select
                        className={inputClass}
                        onChange={(event) => setMealDraft((current) => ({ ...current, recipeId: event.target.value }))}
                        value={mealDraft.recipeId}
                      >
                        <option value="">No recipe</option>
                        {state.recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>{recipe.recipeName}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Dietary flags">
                      <input
                        className={inputClass}
                        onChange={(event) => setMealDraft((current) => ({ ...current, dietaryFlags: event.target.value }))}
                        placeholder="vegetarian, low-sugar"
                        value={mealDraft.dietaryFlags}
                      />
                    </FormField>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <FormField label="Change scope">
                        <select
                          className={inputClass}
                          onChange={(event) => updateMealEffectiveScope(event.target.value as MealEffectiveScope)}
                          value={mealEffectiveScope}
                        >
                          <option value="daily">Daily until date</option>
                          <option value="weekly">Weekly same day</option>
                          <option value="monthly">Monthly same date</option>
                        </select>
                      </FormField>
                      <FormField label="Effective until">
                        <input
                          className={inputClass}
                          min={selectedMeal.planDate}
                          onChange={(event) => setMealEffectiveUntil(event.target.value)}
                          type="date"
                          value={mealEffectiveUntil || selectedMeal.planDate}
                        />
                      </FormField>
                      <Button type="submit">
                        <Save className="size-4" aria-hidden="true" />
                        Save change
                      </Button>
                    </div>
                  </fieldset>
                </form>
              )}
              {[detailSlot.familyMeal, ...detailSlot.personalMeals].filter(Boolean).map((meal) => {
                const item = meal as MealPlanItem
	                const recipe = item.recipeId ? state.recipes.find((candidate) => candidate.id === item.recipeId) : undefined
                return (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4" key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
	                          <Badge tone={isFamilyMeal(item) ? 'slate' : 'indigo'}>{mealAudienceLabel(item, state.members)}</Badge>
                          <Badge tone="green">{item.calories} cal</Badge>
                          <Badge tone="amber">{item.prepTime}m prep</Badge>
                        </div>
                        <h4 className="mt-2 text-base font-bold text-slate-950">{item.mealName}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.description || 'No description added.'}</p>
                      </div>
                      <div className="rounded-xl border border-white bg-white px-3 py-2 text-right text-xs text-slate-500 shadow-sm">
                        <p className="font-semibold text-slate-700">Updated</p>
                        <p>{formatDateTime(item.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">Effective date</p>
                        <p className="mt-1">{formatCompactDate(item.planDate)}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">Recipe</p>
                        <p className="mt-1">{recipe?.recipeName ?? 'No recipe linked'}</p>
                      </div>
                    </div>
                    {item.dietaryFlags && item.dietaryFlags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.dietaryFlags.map((flag) => (
                          <Badge key={flag} tone="teal">{flag}</Badge>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
