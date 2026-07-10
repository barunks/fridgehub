import { useEffect, useMemo, useState } from 'react'
import { createInitialFamilyHubState } from '@/data/seed'
import { answerAssistantQuery } from '@/services/assistantEngine'
import { api } from '@/services/api'
import type {
  FamilyHubState,
  MealPlanItem,
  NewGroceryItemInput,
  NewTaskInput,
  Notification,
} from '@/types/familyHub'
import { dateOffsetIso, dateTimeOffsetIso, todayIso } from '@/utils/date'

const STORAGE_KEY = 'familyhub-ui-state-v1'

const loadState = (): FamilyHubState => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as FamilyHubState) : createInitialFamilyHubState()
  } catch {
    return createInitialFamilyHubState()
  }
}

const nextId = (items: { id: number }[]) => Math.max(0, ...items.map((item) => item.id)) + 1

const createNotification = (
  notifications: Notification[],
  title: string,
  message: string,
  type: Notification['type'],
): Notification => ({
  id: nextId(notifications),
  title,
  message,
  type,
  isRead: false,
  createdAt: new Date().toISOString(),
})

const cycleLengthDays = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
}

export const useFamilyHub = (isAuthenticated = true) => {
  const [state, setState] = useState<FamilyHubState>(loadState)
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  const refreshFromApi = () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    api
      .bootstrap()
      .then((payload) => setState(payload))
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : 'API refresh failed'
        if (msg !== 'AUTH_REQUIRED') {
          setFeedback({ type: 'error', message: msg })
        }
      })
      .finally(() => setIsLoading(false))
  }

  const syncApi = (operation: Promise<unknown>, successMessage: string) => {
    setIsLoading(true)
    operation
      .then(() => {
        setFeedback({ type: 'success', message: successMessage })
        refreshFromApi()
      })
      .catch((error: unknown) => {
        setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Save failed' })
        setIsLoading(false)
      })
  }

  useEffect(() => {
    refreshFromApi()
  }, [isAuthenticated])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const stats = useMemo(() => {
    const activeTasks = state.tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
    const todayTasks = activeTasks.filter((task) => task.dueAt.slice(0, 10) === todayIso())
    const pendingPurchases = state.groceryItems.filter((item) => !item.purchased && !item.currentStock)
    const expiringItems = state.groceryItems.filter((item) => {
      if (!item.expiryDate) {
        return false
      }

      const days = Math.round(
        (new Date(`${item.expiryDate}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime()) /
          86_400_000,
      )
      return days >= 0 && days <= 2
    })
    const todayMeals = state.meals.filter((meal) => meal.planDate === todayIso())

    return {
      activeTasks,
      todayTasks,
      pendingPurchases,
      expiringItems,
      todayMeals,
      unreadNotifications: state.notifications.filter((notification) => !notification.isRead),
      completedTasks: state.tasks.filter((task) => task.status === 'completed'),
    }
  }, [state])

  const toggleTaskStatus = (taskId: number) => {
    const task = state.tasks.find((item) => item.id === taskId)
    const nextStatus = task?.status === 'completed' ? 'pending' : 'completed'

    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: task.status === 'completed' ? 'pending' : 'completed',
            }
          : task,
      ),
    }))
    syncApi(api.updateTask(taskId, { status: nextStatus }), 'Task updated')
  }

  const toggleGroceryPurchased = (itemId: number) => {
    const item = state.groceryItems.find((current) => current.id === itemId)
    const purchased = !item?.purchased

    setState((current) => ({
      ...current,
      groceryItems: current.groceryItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              purchased: !item.purchased,
              currentStock: !item.purchased,
            }
          : item,
      ),
    }))
    syncApi(api.updateGroceryItem(itemId, { purchased }), 'Grocery item updated')
  }

  const toggleCurrentStock = (itemId: number) => {
    const item = state.groceryItems.find((current) => current.id === itemId)
    const currentStock = !item?.currentStock

    setState((current) => ({
      ...current,
      groceryItems: current.groceryItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              currentStock: !item.currentStock,
            }
          : item,
      ),
    }))
    syncApi(api.updateGroceryItem(itemId, { currentStock }), 'Stock updated')
  }

  const addGroceryItem = (input: NewGroceryItemInput) => {
    setState((current) => {
      const id = nextId(current.groceryItems)
      const itemNumber = `GRC-${String(id).padStart(4, '0')}`

      return {
        ...current,
        groceryItems: [
          ...current.groceryItems,
          {
            id,
            itemNumber,
            itemName: input.itemName,
            listTypeId: input.listTypeId,
            quantity: input.quantity,
            unit: input.unit,
            purchaseFrequency: input.purchaseFrequency,
            currentStock: input.currentStock,
            startDate: todayIso(),
            expiryDate: input.purchaseFrequency === 'weekly' ? dateOffsetIso(5) : undefined,
            notes: input.notes,
            familyId: current.family.id,
            purchased: false,
          },
        ],
        notifications: [
          createNotification(
            current.notifications,
            'Grocery item added',
            `${input.itemName} was added to the master list.`,
            'grocery',
          ),
          ...current.notifications,
        ],
      }
    })
    syncApi(api.createGroceryItem(input), 'Grocery item added')
  }

  const regenerateGroceryCycles = () => {
    setState((current) => {
      const cycleKeys = Array.from(
        new Set(current.groceryItems.map((item) => `${item.listTypeId}:${item.purchaseFrequency}`)),
      )
      const cycles = cycleKeys.map((key, index) => {
        const [listTypeId, frequency] = key.split(':')
        const days = cycleLengthDays[frequency as keyof typeof cycleLengthDays]

        return {
          id: index + 1,
          listTypeId: Number(listTypeId),
          frequency: frequency as keyof typeof cycleLengthDays,
          cycleStartDate: todayIso(),
          cycleEndDate: dateOffsetIso(days - 1),
          isCompleted: false,
        }
      })

      return {
        ...current,
        groceryCycles: cycles,
        notifications: [
          createNotification(
            current.notifications,
            'Grocery cycles regenerated',
            `${cycles.length} purchase cycle${cycles.length === 1 ? '' : 's'} were rebuilt from the master list.`,
            'grocery',
          ),
          ...current.notifications,
        ],
      }
    })
    syncApi(api.regenerateGroceryCycles(), 'Grocery cycles regenerated')
  }

  const addListType = (listName: string, description: string, colorClass: string) => {
    setState((current) => ({
      ...current,
      listTypes: [
        ...current.listTypes,
        {
          id: nextId(current.listTypes),
          listName,
          listType: 'standard',
          description,
          colorClass,
        },
      ],
    }))
    syncApi(api.createListType(listName, description, colorClass), 'Shopping list added')
  }

  const addTask = (input: NewTaskInput) => {
    setState((current) => {
      const dueDate = input.dueAt || dateTimeOffsetIso(0, 18)

      return {
        ...current,
        tasks: [
          ...current.tasks,
          {
            id: nextId(current.tasks),
            title: input.title,
            description: `${input.category} reminder`,
            priority: input.priority,
            status: 'pending',
            dueAt: dueDate,
            reminderAt: dueDate,
            recurrenceType: input.recurrenceType || 'none',
            recurrenceInterval: 1,
            assignedTo: input.assignedTo,
            category: input.category,
            actionLabel: 'New',
          },
        ],
        notifications: [
          createNotification(current.notifications, 'Task created', `${input.title} is now on the family board.`, 'task'),
          ...current.notifications,
        ],
      }
    })
    syncApi(api.createTask(input), 'Task added')
  }

  const reassignTask = (taskId: number, assignedTo: number) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, assignedTo } : task)),
    }))
    syncApi(api.updateTask(taskId, { assignedTo }), 'Task reassigned')
  }

  const updateMeal = (mealId: number, mealName: string) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) => (meal.id === mealId ? { ...meal, mealName } : meal)),
    }))
    syncApi(api.updateMeal(mealId, mealName), 'Meal updated')
  }

  const applyWeeklyTemplate = () => {
    setState((current) => ({
      ...current,
      notifications: [
        createNotification(
          current.notifications,
          'Weekly template applied',
          'The full breakfast, lunch, snacks, and dinner plan is active for this week.',
          'meal',
        ),
        ...current.notifications,
      ],
    }))
    syncApi(api.applyMealTemplate(), 'Meal template applied')
  }

  const markNotificationRead = (notificationId: number) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification,
      ),
    }))
    syncApi(api.markNotificationRead(notificationId), 'Notification marked read')
  }

  const addAnnouncement = (title: string, message: string) => {
    setState((current) => ({
      ...current,
      announcements: [
        {
          id: nextId(current.announcements),
          title,
          message,
          ownerId: 1,
          createdAt: new Date().toISOString(),
          tag: 'family',
        },
        ...current.announcements,
      ],
    }))
    syncApi(api.createAnnouncement(title, message), 'Announcement published')
  }

  const askAssistant = (query: string) => {
    const trimmed = query.trim()

    if (!trimmed) {
      return
    }

    setState((current) => {
      const userMessageId = nextId(current.assistantMessages)
      const answer = answerAssistantQuery(trimmed, current)

      return {
        ...current,
        assistantMessages: [
          ...current.assistantMessages,
          {
            id: userMessageId,
            sender: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
          },
          {
            id: userMessageId + 1,
            sender: 'assistant',
            content: answer,
            createdAt: new Date().toISOString(),
          },
        ],
      }
    })
    void api
      .askAssistant(trimmed)
      .then((response) => {
        setState((current) => ({
          ...current,
          assistantMessages: current.assistantMessages.some(
            (message) => message.sender === 'assistant' && message.content === response.answer,
          )
            ? current.assistantMessages
            : [
                ...current.assistantMessages,
                {
                  id: nextId(current.assistantMessages),
                  sender: 'assistant',
                  content: response.answer,
                  createdAt: new Date().toISOString(),
                },
              ],
        }))
      })
      .catch(() => undefined)
  }

  const resetDemoData = () => {
    const freshState = createInitialFamilyHubState()
    setState(freshState)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState))
  }

  const mealsByDay = useMemo(() => {
    return state.meals.reduce<Record<string, MealPlanItem[]>>((accumulator, meal) => {
      accumulator[meal.dayOfWeek] = [...(accumulator[meal.dayOfWeek] ?? []), meal]
      return accumulator
    }, {})
  }, [state.meals])

  return {
    state,
    stats,
    mealsByDay,
    isLoading,
    feedback,
    clearFeedback: () => setFeedback(null),
    toggleTaskStatus,
    toggleGroceryPurchased,
    toggleCurrentStock,
    addGroceryItem,
    addListType,
    regenerateGroceryCycles,
    addTask,
    reassignTask,
    updateMeal,
    applyWeeklyTemplate,
    markNotificationRead,
    addAnnouncement,
    askAssistant,
    resetDemoData,
  }
}

export type FamilyHubStore = ReturnType<typeof useFamilyHub>
