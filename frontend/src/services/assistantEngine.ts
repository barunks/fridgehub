import type { AssistantInsight, FamilyHubState, GroceryItem, Task } from '@/types/familyHub'
import { daysUntil, formatDueLabel, formatTime, isToday } from '@/utils/date'

const byDueDate = (a: Task, b: Task) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()

const formatItemList = (items: GroceryItem[]) =>
  items.map((item) => item.itemName.toLowerCase()).join(', ')

const driveMinutes = (task: Task) => {
  const digits = task.actionLabel?.replace(/\D/g, '')
  return digits ? Number(digits) : 20
}

const leaveTime = (task: Task) => {
  const dueAt = new Date(task.dueAt)
  dueAt.setMinutes(dueAt.getMinutes() - driveMinutes(task) - 12)
  return formatTime(dueAt.toISOString())
}

const backupRecipe = (state: FamilyHubState) =>
  state.recipes.find((recipe) => recipe.dietaryTags.includes('uses-expiring-items'))?.recipeName ?? 'a recipe using expiring groceries'

const openSlotMember = (state: FamilyHubState) =>
  [...state.members].sort((a, b) => a.points - b.points)[0]?.name ?? 'the next available family member'

export const selectUpcomingTasks = (state: FamilyHubState) =>
  state.tasks
    .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
    .sort(byDueDate)

export const selectTodayTasks = (state: FamilyHubState) =>
  selectUpcomingTasks(state).filter((task) => isToday(task.dueAt))

export const selectExpiringItems = (state: FamilyHubState) =>
  state.groceryItems
    .filter((item) => item.expiryDate && daysUntil(item.expiryDate) <= 2 && daysUntil(item.expiryDate) >= 0)
    .sort((a, b) => daysUntil(a.expiryDate ?? '') - daysUntil(b.expiryDate ?? ''))

export const selectPendingPurchases = (state: FamilyHubState) =>
  state.groceryItems.filter((item) => !item.purchased && !item.currentStock)

export const selectTodayMeals = (state: FamilyHubState) =>
  state.meals.filter((meal) => isToday(meal.planDate))

export const generateAssistantInsights = (state: FamilyHubState): AssistantInsight[] => {
  const schoolTask = selectTodayTasks(state).find((task) => task.category === 'school')
  const expiringItems = selectExpiringItems(state)
  const pendingChores = selectTodayTasks(state).filter((task) => task.category === 'chore')
  const dinner = selectTodayMeals(state).find((meal) => meal.mealType === 'dinner')
  const insights: AssistantInsight[] = []

  if (schoolTask) {
    insights.push({
      id: 'leave-window',
      title: 'Leave window',
      body: `Leave by ${leaveTime(schoolTask)} for ${schoolTask.title.toLowerCase()}; current drive estimate is ${driveMinutes(schoolTask)} minutes.`,
      type: 'schedule',
      confidence: 91,
      action: schoolTask.actionLabel,
    })
  }

  if (expiringItems.length > 0) {
    insights.push({
      id: 'expiry-watch',
      title: 'Expiry watch',
      body: `${formatItemList(expiringItems)} expire within 48 hours. Use them before the next grocery cycle closes.`,
      type: 'grocery',
      confidence: 88,
      action: 'Review groceries',
    })
  }

  if (dinner) {
    insights.push({
      id: 'dinner-suggestion',
      title: 'Dinner fit',
      body: `${dinner.mealName} is planned for dinner. ${backupRecipe(state)} remains a backup because it uses expiring groceries.`,
      type: 'meal',
      confidence: 82,
      action: 'Open meals',
    })
  }

  if (pendingChores.length > 0) {
    insights.push({
      id: 'chore-balance',
      title: 'Chore balance',
      body: `${pendingChores.length} chore${pendingChores.length === 1 ? '' : 's'} ${pendingChores.length === 1 ? 'remains' : 'remain'} today. ${openSlotMember(state)} has the next open slot.`,
      type: 'task',
      confidence: 76,
      action: 'Assign chore',
    })
  }

  return insights
}

export const answerAssistantQuery = (query: string, state: FamilyHubState) => {
  const normalized = query.toLowerCase()
  const todayTasks = selectTodayTasks(state)
  const expiringItems = selectExpiringItems(state)
  const pendingPurchases = selectPendingPurchases(state)
  const dinner = selectTodayMeals(state).find((meal) => meal.mealType === 'dinner')

  if (normalized.includes('grocery') || normalized.includes('expire') || normalized.includes('shopping')) {
    if (expiringItems.length === 0 && pendingPurchases.length === 0) {
      return 'No urgent grocery action is open. The current cycle is clean.'
    }

    return `Prioritize ${formatItemList([...expiringItems, ...pendingPurchases].slice(0, 4))}. ${pendingPurchases.length} item${pendingPurchases.length === 1 ? '' : 's'} still need purchase confirmation.`
  }

  if (normalized.includes('meal') || normalized.includes('dinner') || normalized.includes('cook')) {
    return dinner
      ? `${dinner.mealName} is planned for dinner at about ${dinner.calories} calories. ${backupRecipe(state)} is the smartest fallback because it clears expiring groceries.`
      : `No dinner is planned for today. Apply the weekly template or pick ${backupRecipe(state)} from the recipe library.`
  }

  if (normalized.includes('task') || normalized.includes('reminder') || normalized.includes('today')) {
    const firstTask = todayTasks[0]

    if (!firstTask) {
      return 'No active task remains for today.'
    }

    return `The next active task is ${firstTask.title.toLowerCase()} at ${formatTime(firstTask.dueAt)}. ${todayTasks.length} active reminder${todayTasks.length === 1 ? '' : 's'} remain today.`
  }

  if (normalized.includes('school') || normalized.includes('leave')) {
    const schoolTask = todayTasks.find((task) => task.category === 'school')

    return schoolTask
      ? `Leave by ${leaveTime(schoolTask)} for ${schoolTask.title.toLowerCase()}. ${formatDueLabel(schoolTask.dueAt)} is the event time.`
      : 'There is no school event in today\'s active task list.'
  }

  return 'The strongest recommendations are to handle the school travel window, use milk and spinach before expiry, and close the pending grocery purchases before the weekly cycle ends.'
}
