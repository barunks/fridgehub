import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createInitialFamilyHubState } from '@/data/seed'
import { api } from '@/services/api'
import type {
  AuditLogEntry,
  FamilyHubState,
  GroceryItem,
  MealPlanItem,
  NewGroceryItemInput,
  NewTaskInput,
  Notification,
  Permission,
  Recipe,
  Task,
} from '@/types/familyHub'
import { dateOffsetIso, dateTimeOffsetIso, todayIso } from '@/utils/date'

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

type PaginationKey = 'groceryItems' | 'tasks' | 'recipes' | 'notifications' | 'auditLogs'

interface PaginationState {
  limit: number
  offset: number
  hasNext: boolean
  isLoading: boolean
}

const defaultPaginationState = (): PaginationState => ({
  limit: 10,
  offset: 0,
  hasNext: false,
  isLoading: false,
})

const createPagination = (): Record<PaginationKey, PaginationState> => ({
  groceryItems: defaultPaginationState(),
  tasks: defaultPaginationState(),
  recipes: defaultPaginationState(),
  notifications: defaultPaginationState(),
  auditLogs: defaultPaginationState(),
})

export const useFamilyHub = (
  isAuthenticated = true,
  currentUserId: number | null = null,
  authCapabilities: Permission[] = [],
  authRole: string | null = null,
) => {
  const [state, setState] = useState<FamilyHubState>(createInitialFamilyHubState)
  const [isLoading, setIsLoading] = useState(false)
  const [isBackendUnavailable, setIsBackendUnavailable] = useState(false)
  const [isBrowserOffline, setIsBrowserOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine))
  const [pagination, setPagination] = useState(createPagination)
  const paginationRef = useRef(pagination)
  paginationRef.current = pagination
  const [groceryPageItems, setGroceryPageItems] = useState<GroceryItem[] | null>(null)
  const [taskPageItems, setTaskPageItems] = useState<Task[] | null>(null)
  const [recipePageItems, setRecipePageItems] = useState<Recipe[] | null>(null)
  const [notificationPageItems, setNotificationPageItems] = useState<Notification[] | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }
    setState((current) => ({
      ...current,
      capabilities: authCapabilities,
      currentUser: {
        ...current.currentUser,
        userId: currentUserId ?? current.currentUser.userId,
        role: authRole ?? current.currentUser.role,
        capabilities: authCapabilities,
      },
    }))
  }, [authCapabilities, authRole, currentUserId, isAuthenticated])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  useEffect(() => {
    const updateOnlineState = () => setIsBrowserOffline(!navigator.onLine)
    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  const can = (permission: Permission) => (state.capabilities ?? []).includes(permission)

  const guardPermission = (permission: Permission, message = 'This action is not available for your family role') => {
    if (can(permission)) {
      return true
    }
    setFeedback({ type: 'error', message })
    return false
  }

  const refreshFromApi = useCallback(() => {
    if (!isAuthenticated) {
      setState(createInitialFamilyHubState())
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    api
      .bootstrap()
      .then((payload) => {
        setState(payload)
        setIsBackendUnavailable(false)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : 'API refresh failed'
        if (msg !== 'AUTH_REQUIRED') {
          setIsBackendUnavailable(true)
          setFeedback({ type: 'error', message: msg })
        }
      })
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const syncApi = (operation: Promise<unknown>, successMessage: string, rollback?: () => void) => {
    setIsLoading(true)
    operation
      .then(() => {
        setIsBackendUnavailable(false)
        setFeedback({ type: 'success', message: successMessage })
        refreshFromApi()
      })
      .catch((error: unknown) => {
        rollback?.()
        const message = error instanceof Error ? error.message : 'Save failed'
        if (message === 'Failed to fetch' || message === 'NetworkError') {
          setIsBackendUnavailable(true)
        }
        setFeedback({ type: 'error', message })
        setIsLoading(false)
      })
  }

  const mutateWithRollback = (
    update: (current: FamilyHubState) => FamilyHubState,
    operation: Promise<unknown>,
    successMessage: string,
  ) => {
    let snapshot: FamilyHubState | null = null
    setState((current) => {
      snapshot = current
      return update(current)
    })
    syncApi(operation, successMessage, () => {
      if (snapshot) setState(snapshot)
    })
  }

  const updatePageState = (key: PaginationKey, offset: number, resultCount: number) => {
    setPagination((current) => {
      const limit = current[key].limit
      return {
        ...current,
        [key]: {
          ...current[key],
          offset,
          hasNext: resultCount === limit,
          isLoading: false,
        },
      }
    })
  }

  const setPageLoading = (key: PaginationKey, isLoading: boolean) => {
    setPagination((current) => ({
      ...current,
      [key]: {
        ...current[key],
        isLoading,
      },
    }))
  }

  const pageError = (key: PaginationKey, error: unknown) => {
    setPageLoading(key, false)
    const message = error instanceof Error ? error.message : 'Page load failed'
    if (message !== 'AUTH_REQUIRED') {
      setIsBackendUnavailable(true)
      setFeedback({ type: 'error', message })
    }
  }

  const loadGroceryPage = useCallback((offset?: number, listTypeId?: number | 'all') => {
    const key: PaginationKey = 'groceryItems'
    const p = paginationRef.current[key]
    const nextOffset = Math.max(0, offset ?? p.offset)
    setPageLoading(key, true)
    api
      .listGroceryItems({ limit: p.limit, offset: nextOffset, listTypeId })
      .then((items) => {
        setGroceryPageItems(items)
        setIsBackendUnavailable(false)
        updatePageState(key, nextOffset, items.length)
      })
      .catch((error) => pageError(key, error))
  }, [])

  const loadTaskPage = useCallback((offset?: number, status?: string | 'all') => {
    const key: PaginationKey = 'tasks'
    const p = paginationRef.current[key]
    const nextOffset = Math.max(0, offset ?? p.offset)
    setPageLoading(key, true)
    api
      .listTasks({ limit: p.limit, offset: nextOffset, status })
      .then((items) => {
        setTaskPageItems(items)
        setIsBackendUnavailable(false)
        updatePageState(key, nextOffset, items.length)
      })
      .catch((error) => pageError(key, error))
  }, [])

  const loadRecipePage = useCallback((offset?: number) => {
    const key: PaginationKey = 'recipes'
    const p = paginationRef.current[key]
    const nextOffset = Math.max(0, offset ?? p.offset)
    setPageLoading(key, true)
    api
      .listRecipes({ limit: p.limit, offset: nextOffset })
      .then((items) => {
        setRecipePageItems(items)
        setIsBackendUnavailable(false)
        updatePageState(key, nextOffset, items.length)
      })
      .catch((error) => pageError(key, error))
  }, [])

  const loadNotificationPage = useCallback((offset?: number, unreadOnly = false) => {
    const key: PaginationKey = 'notifications'
    const p = paginationRef.current[key]
    const nextOffset = Math.max(0, offset ?? p.offset)
    setPageLoading(key, true)
    api
      .listNotifications({ limit: p.limit, offset: nextOffset, unreadOnly })
      .then((items) => {
        setNotificationPageItems(items)
        setIsBackendUnavailable(false)
        updatePageState(key, nextOffset, items.length)
      })
      .catch((error) => pageError(key, error))
  }, [])

  const loadAuditLogs = useCallback((offset?: number, entityType?: string) => {
    const key: PaginationKey = 'auditLogs'
    const p = paginationRef.current[key]
    const nextOffset = Math.max(0, offset ?? p.offset)
    setPageLoading(key, true)
    api
      .listAuditLogs({ limit: p.limit, offset: nextOffset, entityType })
      .then((items) => {
        setAuditLogs(items)
        setIsBackendUnavailable(false)
        updatePageState(key, nextOffset, items.length)
      })
      .catch((error) => pageError(key, error))
  }, [])

  useEffect(() => {
    refreshFromApi()
  }, [refreshFromApi])

  const stats = useMemo(() => {
    const activeTasks = state.tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
    const todayTasks = activeTasks.filter((task) => task.dueAt.slice(0, 10) === todayIso())
    const pendingPurchases = state.groceryItems.filter((item) => item.needsPurchase)
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
    if (!guardPermission('manage_tasks')) {
      return
    }
    const task = state.tasks.find((item) => item.id === taskId)
    const nextStatus = task?.status === 'completed' ? 'pending' : 'completed'

    mutateWithRollback(
      (current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: task.status === 'completed' ? 'pending' : 'completed',
              }
            : task,
        ),
      }),
      api.updateTask(taskId, { status: nextStatus }),
      'Task updated',
    )
  }

  const toggleGroceryPurchased = (itemId: number) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    const item = state.groceryItems.find((current) => current.id === itemId)
    const purchased = !item?.purchased

    mutateWithRollback(
      (current) => ({
        ...current,
        groceryItems: current.groceryItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                purchased: !item.purchased,
                currentStock: !item.purchased,
                needsPurchase: item.purchased,
              }
            : item,
        ),
      }),
      api.updateGroceryItem(itemId, { purchased }),
      'Grocery item updated',
    )
  }

  const toggleCurrentStock = (itemId: number) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    const item = state.groceryItems.find((current) => current.id === itemId)
    const currentStock = !item?.currentStock

    mutateWithRollback(
      (current) => ({
        ...current,
        groceryItems: current.groceryItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                currentStock: !item.currentStock,
                purchased: !item.currentStock,
                needsPurchase: item.currentStock,
              }
            : item,
        ),
      }),
      api.updateGroceryItem(itemId, { currentStock }),
      'Stock updated',
    )
  }

  const addGroceryItem = (input: NewGroceryItemInput) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    mutateWithRollback(
      (current) => {
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
              purchased: input.currentStock,
              needsPurchase: !input.currentStock,
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
      },
      api.createGroceryItem(input),
      'Grocery item added',
    )
  }

  const regenerateGroceryCycles = () => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    mutateWithRollback(
      (current) => {
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
      },
      api.regenerateGroceryCycles(),
      'Grocery cycles regenerated',
    )
  }

  const addListType = (listName: string, description: string, colorClass: string) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    mutateWithRollback(
      (current) => ({
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
      }),
      api.createListType(listName, description, colorClass),
      'Shopping list added',
    )
  }

  const addTask = (input: NewTaskInput) => {
    if (!guardPermission('manage_tasks')) {
      return
    }
    mutateWithRollback(
      (current) => {
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
              reminderAt: input.reminderAt || dueDate,
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
      },
      api.createTask(input),
      'Task added',
    )
  }

  const reassignTask = (taskId: number, assignedTo: number) => {
    if (!guardPermission('manage_tasks')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, assignedTo } : task)),
      }),
      api.updateTask(taskId, { assignedTo }),
      'Task reassigned',
    )
  }

  const updateMeal = (mealId: number, mealName: string) => {
    if (!guardPermission('manage_meals')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        meals: current.meals.map((meal) => (meal.id === mealId ? { ...meal, mealName } : meal)),
      }),
      api.updateMeal(mealId, mealName),
      'Meal updated',
    )
  }

  const applyWeeklyTemplate = () => {
    if (!guardPermission('manage_meals')) {
      return
    }
    mutateWithRollback(
      (current) => ({
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
      }),
      api.applyMealTemplate(),
      'Meal template applied',
    )
  }

  const markNotificationRead = (notificationId: number) => {
    if (!guardPermission('mark_notifications')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        notifications: current.notifications.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification,
        ),
      }),
      api.markNotificationRead(notificationId),
      'Notification marked read',
    )
  }

  const addAnnouncement = (title: string, message: string) => {
    if (!guardPermission('manage_announcements')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        announcements: [
          {
            id: nextId(current.announcements),
            title,
            message,
            ownerId: currentUserId || 0,
            createdAt: new Date().toISOString(),
            tag: 'family',
          },
          ...current.announcements,
        ],
      }),
      api.createAnnouncement(title, message),
      'Announcement published',
    )
  }

  const askAssistant = (query: string) => {
    if (!guardPermission('use_assistant')) {
      return
    }
    const trimmed = query.trim()

    if (!trimmed) {
      return
    }

    setState((current) => {
      const userMessageId = nextId(current.assistantMessages)

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
        ],
      }
    })
    void api
      .askAssistant(trimmed)
      .then((response) => {
        setState((current) => ({
          ...current,
          assistantInsights: response.insights,
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
      .catch((error: unknown) => {
        setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Assistant request failed' })
      })
  }

  const resetDemoData = () => {
    const freshState = createInitialFamilyHubState()
    setState(freshState)
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
    isBackendUnavailable,
    isBrowserOffline,
    isOffline: isBackendUnavailable || isBrowserOffline,
    feedback,
    currentUserId,
    can,
    pagination,
    paged: {
      groceryItems: groceryPageItems,
      tasks: taskPageItems,
      recipes: recipePageItems,
      notifications: notificationPageItems,
    },
    auditLogs,
    clearFeedback: () => setFeedback(null),
    loadGroceryPage,
    loadTaskPage,
    loadRecipePage,
    loadNotificationPage,
    loadAuditLogs,
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
