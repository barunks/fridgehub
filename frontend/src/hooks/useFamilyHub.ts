import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEmptyFamilyHubState, createInitialFamilyHubState } from '@/data/seed'
import { api } from '@/services/api'
import type {
  AuditLogEntry,
  FamilyHubState,
  GroceryItem,
  GroceryItemUpdateInput,
  MealPlanItem,
  MealUpdateInput,
  NewGroceryItemInput,
  NewShoppingItemInput,
  NewTaskInput,
  Notification,
  Permission,
  Recipe,
  ShoppingCycleItem,
  ShoppingItemUpdateInput,
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
  semi_annually: 182,
  yearly: 365,
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
  const [state, setState] = useState<FamilyHubState>(createEmptyFamilyHubState)
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
  const [memberMeals, setMemberMeals] = useState<MealPlanItem[] | null>(null)
  const [memberMealsLoading, setMemberMealsLoading] = useState(false)
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

  const refreshFromApi = useCallback((): Promise<void> => {
    if (!isAuthenticated) {
      setState(createEmptyFamilyHubState())
      setIsLoading(false)
      return Promise.resolve()
    }
    setIsLoading(true)
    return api
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
    return operation
      .then(() => {
        setIsBackendUnavailable(false)
        setFeedback({ type: 'success', message: successMessage })
        return refreshFromApi()
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
    updatePageCaches?: () => void,
  ) => {
    let snapshot: FamilyHubState | null = null
    const groceryPageSnapshot = groceryPageItems
    const taskPageSnapshot = taskPageItems
    const recipePageSnapshot = recipePageItems
    const notificationPageSnapshot = notificationPageItems
    const auditLogSnapshot = auditLogs
    const memberMealsSnapshot = memberMeals
    setState((current) => {
      snapshot = current
      return update(current)
    })
    updatePageCaches?.()
    return syncApi(operation, successMessage, () => {
      if (snapshot) setState(snapshot)
      setGroceryPageItems(groceryPageSnapshot)
      setTaskPageItems(taskPageSnapshot)
      setRecipePageItems(recipePageSnapshot)
      setNotificationPageItems(notificationPageSnapshot)
      setAuditLogs(auditLogSnapshot)
      setMemberMeals(memberMealsSnapshot)
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

  const loadMemberMeals = useCallback((memberId: number | null) => {
    if (memberId === null) {
      setMemberMeals(null)
      return
    }
    setMemberMealsLoading(true)
    api
      .getWeeklyMeals(memberId)
      .then((items) => {
        setMemberMeals(items)
        setIsBackendUnavailable(false)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : 'Failed to load member meals'
        if (msg !== 'AUTH_REQUIRED') {
          setFeedback({ type: 'error', message: msg })
        }
      })
      .finally(() => setMemberMealsLoading(false))
  }, [])

  const buildShoppingList = useCallback(() => {
    if (!isAuthenticated) {
      return Promise.resolve()
    }
    setIsLoading(true)
    return api
      .buildShoppingList()
      .then(() => {
        setIsBackendUnavailable(false)
        return refreshFromApi()
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : 'Failed to build shopping list'
        if (msg !== 'AUTH_REQUIRED') {
          setFeedback({ type: 'error', message: msg })
        }
        setIsLoading(false)
      })
  }, [isAuthenticated, refreshFromApi])

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
    const nextStatus: Task['status'] = task?.status === 'completed' ? 'pending' : 'completed'
    const updateTaskStatus = (tasks: Task[]): Task[] =>
      tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: task.status === 'completed' ? 'pending' : 'completed',
            }
          : task,
      )

    mutateWithRollback(
      (current) => ({
        ...current,
        tasks: updateTaskStatus(current.tasks),
      }),
      api.updateTask(taskId, { status: nextStatus }),
      'Task updated',
      () => setTaskPageItems((current) => (current ? updateTaskStatus(current) : current)),
    )
  }

  const toggleGroceryPurchased = (itemId: number) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    const item = state.groceryItems.find((current) => current.id === itemId)
    const purchased = !item?.purchased
    const updateGroceryPurchased = (items: GroceryItem[]) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              purchased: !item.purchased,
              currentStock: !item.purchased,
              needsPurchase: item.purchased,
            }
          : item,
      )
    const updateShoppingPurchased = (items: ShoppingCycleItem[]) =>
      items.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              isPurchased: purchased,
              purchasedQuantity: purchased ? item.quantity : 0,
            }
          : item,
      )

    return mutateWithRollback(
      (current) => ({
        ...current,
        groceryItems: updateGroceryPurchased(current.groceryItems),
        shoppingItems: updateShoppingPurchased(current.shoppingItems),
      }),
      api.updateGroceryItem(itemId, { purchased }),
      'Grocery item updated',
      () => setGroceryPageItems((current) => (current ? updateGroceryPurchased(current) : current)),
    )
  }

  const toggleCurrentStock = (itemId: number) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    const item = state.groceryItems.find((current) => current.id === itemId)
    const currentStock = !item?.currentStock
    const updateGroceryStock = (items: GroceryItem[]) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              currentStock: !item.currentStock,
              purchased: !item.currentStock,
              needsPurchase: item.currentStock,
            }
          : item,
      )
    const updateShoppingPurchased = (items: ShoppingCycleItem[]) =>
      items.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              isPurchased: currentStock,
              purchasedQuantity: currentStock ? item.quantity : 0,
            }
          : item,
      )

    return mutateWithRollback(
      (current) => ({
        ...current,
        groceryItems: updateGroceryStock(current.groceryItems),
        shoppingItems: updateShoppingPurchased(current.shoppingItems),
      }),
      api.updateGroceryItem(itemId, { currentStock }),
      'Stock updated',
      () => setGroceryPageItems((current) => (current ? updateGroceryStock(current) : current)),
    )
  }

  const updateGroceryItem = (itemId: number, patch: GroceryItemUpdateInput) => {
    if (!guardPermission('manage_groceries')) {
      return
    }

    const applyPatch = (items: GroceryItem[]) =>
      items.map((item) => {
        if (item.id !== itemId) return item

        const currentStock = patch.currentStock ?? item.currentStock
        return {
          ...item,
          ...patch,
          currentStock,
          purchased: patch.currentStock !== undefined ? currentStock : patch.purchased ?? item.purchased,
          needsPurchase: patch.currentStock !== undefined ? !currentStock : item.needsPurchase,
        }
      })

    return mutateWithRollback(
      (current) => ({
        ...current,
        groceryItems: applyPatch(current.groceryItems),
      }),
      api.updateGroceryItem(itemId, patch),
      'Grocery item updated',
      () => setGroceryPageItems((current) => (current ? applyPatch(current) : current)),
    )
  }

  const updateShoppingItem = (subItemId: number, patch: ShoppingItemUpdateInput) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    const target = state.shoppingItems.find((item) => item.id === subItemId)
    if (!target) {
      return
    }

    const updateShoppingItems = (items: ShoppingCycleItem[]) =>
      items.map((item) => {
        if (item.id !== subItemId) return item

        const quantity = patch.quantity ?? item.quantity
        const unit = patch.unit ?? item.unit
        const notes = patch.notes ?? item.notes
        let purchasedQuantity = item.purchasedQuantity
        let isPurchased = item.isPurchased

        if (patch.isPurchased !== undefined) {
          isPurchased = patch.isPurchased
          purchasedQuantity = patch.isPurchased ? quantity : 0
        } else if (patch.purchasedQuantity !== undefined) {
          purchasedQuantity = Math.min(Math.max(patch.purchasedQuantity, 0), quantity)
          isPurchased = quantity <= 0 || purchasedQuantity >= quantity
        } else if (patch.quantity !== undefined) {
          purchasedQuantity = Math.min(purchasedQuantity, quantity)
          isPurchased = quantity <= 0 || purchasedQuantity >= quantity
        }

        return {
          ...item,
          quantity,
          unit,
          notes,
          purchasedQuantity,
          isPurchased,
        }
      })

    const updatedTarget = updateShoppingItems([target])[0]
    const updateGroceryStatus = (items: GroceryItem[]) =>
      items.map((item) =>
        item.id === target.itemId
          ? {
              ...item,
              purchased: updatedTarget.isPurchased,
              currentStock: updatedTarget.isPurchased,
              needsPurchase: !updatedTarget.isPurchased,
            }
          : item,
      )

    return mutateWithRollback(
      (current) => ({
        ...current,
        shoppingItems: updateShoppingItems(current.shoppingItems),
        groceryItems: updateGroceryStatus(current.groceryItems),
      }),
      api.updateShoppingItem(subItemId, patch),
      'Shopping item updated',
      () => setGroceryPageItems((current) => (current ? updateGroceryStatus(current) : current)),
    )
  }

  const addShoppingItem = (input: NewShoppingItemInput) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    return syncApi(api.createShoppingItem(input), 'Shopping item added')
  }

  const addGroceryItem = (input: NewGroceryItemInput) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    return mutateWithRollback(
      (current) => {
        const id = nextId(current.groceryItems)
        const itemNumber = `GRC-${String(id).padStart(4, '0')}`
        const cycle = current.groceryCycles.find(
          (candidate) => candidate.listTypeId === input.listTypeId && candidate.frequency === input.purchaseFrequency,
        )

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
          shoppingItems: cycle
            ? [
                ...current.shoppingItems,
                {
                  id: nextId(current.shoppingItems),
                  cycleId: cycle.id,
                  itemId: id,
                  itemNumber,
                  itemName: input.itemName,
                  listTypeId: input.listTypeId,
                  frequency: input.purchaseFrequency,
                  quantity: input.quantity,
                  unit: input.unit,
                  isPurchased: input.currentStock,
                  purchasedQuantity: input.currentStock ? input.quantity : 0,
                  notes: input.notes,
                  isAdhoc: false,
                  carriedForward: false,
                },
              ]
            : current.shoppingItems,
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
    return mutateWithRollback(
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

        const shoppingItems = current.groceryItems.flatMap((item) => {
          const cycle = cycles.find(
            (candidate) => candidate.listTypeId === item.listTypeId && candidate.frequency === item.purchaseFrequency,
          )
          if (!cycle) return []
          return [
            {
              id: item.id,
              cycleId: cycle.id,
              itemId: item.id,
              itemNumber: item.itemNumber,
              itemName: item.itemName,
              listTypeId: item.listTypeId,
              frequency: item.purchaseFrequency,
              quantity: item.quantity,
              unit: item.unit,
              isPurchased: item.purchased,
              purchasedQuantity: item.purchased ? item.quantity : 0,
              notes: item.notes,
              isAdhoc: false,
              carriedForward: false,
            },
          ]
        })

        return {
          ...current,
          groceryCycles: cycles,
          shoppingItems,
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
    const updateTaskAssignment = (tasks: Task[]) =>
      tasks.map((task) => (task.id === taskId ? { ...task, assignedTo } : task))

    mutateWithRollback(
      (current) => ({
        ...current,
        tasks: updateTaskAssignment(current.tasks),
      }),
      api.updateTask(taskId, { assignedTo }),
      'Task reassigned',
      () => setTaskPageItems((current) => (current ? updateTaskAssignment(current) : current)),
    )
  }

  const updateMeal = (mealId: number, input: MealUpdateInput | string) => {
    if (!guardPermission('manage_meals')) {
      return
    }
    const payload: MealUpdateInput = typeof input === 'string' ? { mealName: input } : input
    const applyUpdate = (meal: MealPlanItem): MealPlanItem => (meal.id === mealId ? { ...meal, ...payload } : meal)
    mutateWithRollback(
      (current) => ({
        ...current,
        meals: current.meals.map(applyUpdate),
      }),
      api.updateMeal(mealId, payload),
      'Meal updated',
      () => setMemberMeals((current) => (current ? current.map(applyUpdate) : current)),
    )
  }

  const applyWeeklyTemplate = (memberId?: number | null, templateName?: string | null) => {
    if (!guardPermission('manage_meals')) {
      return Promise.resolve()
    }
    return mutateWithRollback(
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
      api.applyMealTemplate(memberId, templateName).then((meals) => {
        if (memberId !== null && memberId !== undefined) {
          setMemberMeals(meals)
        }
        setState((current) => {
          if (memberId === null || memberId === undefined) {
            return { ...current, meals }
          }
          return {
            ...current,
            meals: current.meals.filter((meal) => meal.assignedTo !== memberId).concat(meals),
          }
        })
      }),
      'Meal template applied',
    )
  }

  const applyWeeklyTemplateForAll = (templateName?: string | null) => {
    if (!guardPermission('manage_meals')) {
      return Promise.resolve()
    }
    return mutateWithRollback(
      (current) => ({
        ...current,
        notifications: [
          createNotification(
            current.notifications,
            'Weekly template applied',
            'The full breakfast, lunch, snacks, and dinner plan is active for all family members this week.',
            'meal',
          ),
          ...current.notifications,
        ],
      }),
      api.applyMealTemplateAll(templateName).then((meals) => {
        setState((current) => ({
          ...current,
          meals,
        }))
        setMemberMeals((current) => {
          if (!current || current.length === 0) return current
          const memberId = current[0]?.assignedTo
          return memberId ? meals.filter((meal) => meal.assignedTo === memberId) : current
        })
      }),
      'Meal templates applied',
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

  const markAllNotificationsRead = () => {
    if (!guardPermission('mark_notifications')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        notifications: current.notifications.map((notification) => ({ ...notification, isRead: true })),
      }),
      api.markAllNotificationsRead(),
      'Notifications marked read',
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

  const addMember = (input: { name: string; email: string; username: string; password: string; role: string; colorClass: string }) => {
    if (!guardPermission('manage_family')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        members: [
          ...current.members,
          {
            id: nextId(current.members),
            name: input.name,
            role: input.role,
            permissions: [],
            colorClass: input.colorClass,
            initial: input.name.charAt(0).toUpperCase(),
            status: 'Active',
            points: 0,
          },
        ],
      }),
      api.createMember(input),
      'Member added',
    )
  }

  const updateMember = (memberId: number, payload: { name?: string; role?: string; colorClass?: string; status?: string; points?: number; dietaryNotes?: string[] }) => {
    if (!guardPermission('manage_family')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        members: current.members.map((m) =>
          m.id === memberId ? { ...m, ...payload, initial: payload.name ? payload.name.charAt(0).toUpperCase() : m.initial } : m,
        ),
      }),
      api.updateMember(memberId, payload),
      'Member updated',
    )
  }

  const deleteMember = (memberId: number) => {
    if (!guardPermission('manage_family')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        members: current.members.filter((m) => m.id !== memberId),
      }),
      api.deleteMember(memberId),
      'Member removed',
    )
  }

  const addEmergencyContact = (label: string, value: string) => {
    if (!guardPermission('manage_contacts')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        emergencyContacts: [
          ...current.emergencyContacts,
          { id: nextId(current.emergencyContacts), label, value },
        ],
      }),
      api.createEmergencyContact(label, value),
      'Emergency contact added',
    )
  }

  const updateEmergencyContact = (contactId: number, payload: { label?: string; value?: string }) => {
    if (!guardPermission('manage_contacts')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        emergencyContacts: current.emergencyContacts.map((c) =>
          c.id === contactId ? { ...c, ...payload } : c,
        ),
      }),
      api.updateEmergencyContact(contactId, payload),
      'Emergency contact updated',
    )
  }

  const deleteEmergencyContact = (contactId: number) => {
    if (!guardPermission('manage_contacts')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        emergencyContacts: current.emergencyContacts.filter((c) => c.id !== contactId),
      }),
      api.deleteEmergencyContact(contactId),
      'Emergency contact removed',
    )
  }

  const deleteAnnouncement = (announcementId: number) => {
    if (!guardPermission('manage_announcements')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        announcements: current.announcements.filter((a) => a.id !== announcementId),
      }),
      api.deleteAnnouncement(announcementId),
      'Announcement removed',
    )
  }

  const deleteTask = (taskId: number) => {
    if (!guardPermission('manage_tasks')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        tasks: current.tasks.filter((t) => t.id !== taskId),
      }),
      api.deleteTask(taskId),
      'Task deleted',
      () => setTaskPageItems((current) => current ? current.filter((t) => t.id !== taskId) : current),
    )
  }

  const deleteGroceryItem = (itemId: number) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    return mutateWithRollback(
      (current) => ({
        ...current,
        groceryItems: current.groceryItems.filter((i) => i.id !== itemId),
        shoppingItems: current.shoppingItems.filter((i) => i.itemId !== itemId),
      }),
      api.deleteGroceryItem(itemId),
      'Grocery item deleted',
      () => setGroceryPageItems((current) => current ? current.filter((i) => i.id !== itemId) : current),
    )
  }

  const updateListType = (listTypeId: number, payload: { listName?: string; description?: string; colorClass?: string }) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        listTypes: current.listTypes.map((lt) =>
          lt.id === listTypeId ? { ...lt, ...payload } : lt,
        ),
      }),
      api.updateListType(listTypeId, payload),
      'Shopping place updated',
    )
  }

  const deleteListType = (listTypeId: number) => {
    if (!guardPermission('manage_groceries')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        listTypes: current.listTypes.filter((lt) => lt.id !== listTypeId),
      }),
      api.deleteListType(listTypeId),
      'Shopping place removed',
    )
  }

  const addRecipe = (input: { recipeName: string; description?: string; ingredients?: string[]; prepTime?: number; cookTime?: number; servings?: number; difficulty?: 'easy' | 'medium' | 'hard'; cuisine?: string; dietaryTags?: string[] }) => {
    if (!guardPermission('manage_recipes')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        recipes: [
          ...current.recipes,
          {
            id: nextId(current.recipes),
            recipeName: input.recipeName,
            description: input.description || '',
            ingredients: input.ingredients || [],
            prepTime: input.prepTime || 0,
            cookTime: input.cookTime || 0,
            servings: input.servings || 1,
            difficulty: input.difficulty || 'easy',
            cuisine: input.cuisine || '',
            dietaryTags: input.dietaryTags || [],
          },
        ],
      }),
      api.createRecipe(input),
      'Recipe added',
      () => setRecipePageItems(null),
    )
  }

  const updateRecipe = (recipeId: number, payload: Record<string, unknown>) => {
    if (!guardPermission('manage_recipes')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        recipes: current.recipes.map((r) =>
          r.id === recipeId ? { ...r, ...payload } as Recipe : r,
        ),
      }),
      api.updateRecipe(recipeId, payload),
      'Recipe updated',
      () => setRecipePageItems((current) => current ? current.map((r) => r.id === recipeId ? { ...r, ...payload } as Recipe : r) : current),
    )
  }

  const deleteRecipe = (recipeId: number) => {
    if (!guardPermission('manage_recipes')) {
      return
    }
    mutateWithRollback(
      (current) => ({
        ...current,
        recipes: current.recipes.filter((r) => r.id !== recipeId),
      }),
      api.deleteRecipe(recipeId),
      'Recipe deleted',
      () => setRecipePageItems((current) => current ? current.filter((r) => r.id !== recipeId) : current),
    )
  }

  const askAssistant = (query: string) => {
    if (!guardPermission('use_assistant')) {
      return Promise.resolve()
    }
    const trimmed = query.trim()

    if (!trimmed) {
      return Promise.resolve()
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
    return api
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
        throw error
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
    memberMeals,
    memberMealsLoading,
    auditLogs,
    clearFeedback: () => setFeedback(null),
    loadGroceryPage,
    loadTaskPage,
    loadRecipePage,
    loadNotificationPage,
    loadAuditLogs,
    loadMemberMeals,
    buildShoppingList,
    toggleTaskStatus,
    toggleGroceryPurchased,
    toggleCurrentStock,
    updateGroceryItem,
    updateShoppingItem,
    addShoppingItem,
    addGroceryItem,
    addListType,
    regenerateGroceryCycles,
    addTask,
    reassignTask,
    updateMeal,
    applyWeeklyTemplate,
    applyWeeklyTemplateForAll,
    markNotificationRead,
    markAllNotificationsRead,
    addAnnouncement,
    addMember,
    updateMember,
    deleteMember,
    addEmergencyContact,
    updateEmergencyContact,
    deleteEmergencyContact,
    deleteAnnouncement,
    deleteTask,
    deleteGroceryItem,
    updateListType,
    deleteListType,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    askAssistant,
    resetDemoData,
  }
}

export type FamilyHubStore = ReturnType<typeof useFamilyHub>
