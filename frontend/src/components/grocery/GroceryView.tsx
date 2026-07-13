import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Edit3,
  Filter,
  List,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type {
  Frequency,
  GroceryItem,
  GroceryItemUpdateInput,
  NewGroceryItemInput,
  NewShoppingItemInput,
  ShoppingCycleItem,
} from '@/types/familyHub'
import { formatCompactDate, todayIso } from '@/utils/date'
import { cn } from '@/utils/style'

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annually', label: 'Semi-annually' },
  { value: 'yearly', label: 'Yearly' },
] satisfies Array<{ value: Frequency; label: string }>

const unitOptions = ['Kg', 'g', 'Lt', 'ml', 'Units', 'Pack', 'Dozen', 'Bottle', 'Bunch', 'Cups']
const placeColorOptions = [
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-sky-500', label: 'Sky' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-indigo-500', label: 'Indigo' },
  { value: 'bg-emerald-500', label: 'Emerald' },
  { value: 'bg-slate-500', label: 'Slate' },
]

const cellInputClass =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400'
const cellSelectClass = cn(cellInputClass, 'appearance-auto')
const tableHeadClass =
  'whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-600'
const tableCellClass = 'border-b border-slate-100 px-3 py-2 align-middle text-xs text-slate-700'

type Tab = 'master' | 'shopping' | 'places' | 'cycles'
type StockFilter = 'all' | 'yes' | 'no'
type SortDirection = 'asc' | 'desc'
type SortKey = 'itemNumber' | 'listType' | 'itemName' | 'quantity' | 'purchaseFrequency' | 'currentStock' | 'startDate'
type GroceryDraft = NewGroceryItemInput & { startDate: string }
interface ViewFilters {
  listTypeId: number | 'all'
  frequency: Frequency | 'all'
  stock: StockFilter
  itemName: string
  search: string
}

const defaultViewFilters: ViewFilters = {
  listTypeId: 'all',
  frequency: 'all',
  stock: 'all',
  itemName: 'all',
  search: '',
}

const createEmptyItem = (listTypeId = 1): GroceryDraft => ({
  itemName: '',
  listTypeId,
  quantity: 1,
  unit: 'Units',
  purchaseFrequency: 'weekly',
  currentStock: false,
  startDate: todayIso(),
  notes: '',
})

const frequencyLabel = (value: Frequency) =>
  frequencyOptions.find((option) => option.value === value)?.label ?? value

const frequencyTone = (value: Frequency) => {
  if (value === 'daily') return 'rose'
  if (value === 'weekly') return 'green'
  if (value === 'monthly') return 'blue'
  if (value === 'quarterly') return 'amber'
  if (value === 'semi_annually') return 'violet'
  return 'teal'
}

const toEditDraft = (item: GroceryItem): GroceryDraft => ({
  itemName: item.itemName,
  listTypeId: item.listTypeId,
  quantity: item.quantity,
  unit: item.unit || 'Units',
  purchaseFrequency: item.purchaseFrequency,
  currentStock: item.currentStock,
  startDate: item.startDate || todayIso(),
  notes: item.notes,
})

const normalizeText = (value: string) => value.toLowerCase().trim()

export const GroceryView = ({ store }: { store: FamilyHubStore }) => {
  const {
    state,
    addGroceryItem,
    updateGroceryItem,
    addListType,
    updateListType,
    deleteListType,
    deleteGroceryItem,
    buildShoppingList,
    regenerateGroceryCycles,
    toggleCurrentStock,
    toggleGroceryPurchased,
    updateShoppingItem,
    addShoppingItem,
  } = store
  const canManageGroceries = store.can('manage_groceries')
  const firstListId = state.listTypes[0]?.id ?? 1

  const [tab, setTab] = useState<Tab>('master')
  const [shopFilters, setShopFilters] = useState<ViewFilters>(defaultViewFilters)
  const [cycleFilters, setCycleFilters] = useState<ViewFilters>(defaultViewFilters)
  const [masterPage, setMasterPage] = useState(0)
  const [masterPageSize, setMasterPageSize] = useState(10)
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'itemNumber',
    direction: 'asc',
  })
  const [draft, setDraft] = useState<GroceryDraft>(() => createEmptyItem(firstListId))
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<GroceryDraft | null>(null)
  const [shoppingDraft, setShoppingDraft] = useState<NewShoppingItemInput>({
    itemName: '',
    listTypeId: firstListId,
    quantity: 1,
    unit: 'Units',
    purchaseFrequency: 'weekly',
    notes: '',
  })
  const [purchaseDrafts, setPurchaseDrafts] = useState<Record<number, string>>({})
  const [requiredDrafts, setRequiredDrafts] = useState<Record<number, string>>({})
  const [newPlace, setNewPlace] = useState({ name: '', description: '', color: 'bg-slate-500' })
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null)
  const [placeEdit, setPlaceEdit] = useState({ listName: '', description: '', colorClass: '' })

  useEffect(() => {
    if (tab === 'shopping') {
      void buildShoppingList()
    }
  }, [buildShoppingList, tab])

  useEffect(() => {
    if (!state.listTypes.length) return
    setDraft((current) =>
      state.listTypes.some((listType) => listType.id === current.listTypeId)
        ? current
        : createEmptyItem(firstListId),
    )
    setShoppingDraft((current) =>
      state.listTypes.some((listType) => listType.id === current.listTypeId)
        ? current
        : { ...current, listTypeId: firstListId },
    )
  }, [firstListId, state.listTypes])

  const listTypeById = useMemo(() => {
    return new Map(state.listTypes.map((listType) => [listType.id, listType]))
  }, [state.listTypes])

  const itemNameOptions = useMemo(() => {
    return Array.from(new Set(state.groceryItems.map((item) => item.itemName))).sort((a, b) => a.localeCompare(b))
  }, [state.groceryItems])

  const itemCountByListType = useMemo(() => {
    const counts = new Map<number, number>()
    state.groceryItems.forEach((item) => {
      counts.set(item.listTypeId, (counts.get(item.listTypeId) ?? 0) + 1)
    })
    return counts
  }, [state.groceryItems])

  const sortedMasterItems = useMemo(() => {
    return [...state.groceryItems].sort((left, right) => {
      const direction = sort.direction === 'asc' ? 1 : -1
      const leftList = listTypeById.get(left.listTypeId)?.listName ?? ''
      const rightList = listTypeById.get(right.listTypeId)?.listName ?? ''
      const values: Record<SortKey, [string | number | boolean, string | number | boolean]> = {
        itemNumber: [left.itemNumber, right.itemNumber],
        listType: [leftList, rightList],
        itemName: [left.itemName, right.itemName],
        quantity: [left.quantity, right.quantity],
        purchaseFrequency: [left.purchaseFrequency, right.purchaseFrequency],
        currentStock: [left.currentStock, right.currentStock],
        startDate: [left.startDate, right.startDate],
      }
      const [a, b] = values[sort.key]
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction
      return String(a).localeCompare(String(b)) * direction
    })
  }, [listTypeById, sort, state.groceryItems])

  const totalMasterPages = Math.max(1, Math.ceil(sortedMasterItems.length / masterPageSize))
  const currentMasterPage = Math.min(masterPage, totalMasterPages - 1)
  const paginatedMasterItems = useMemo(() => {
    const offset = currentMasterPage * masterPageSize
    return sortedMasterItems.slice(offset, offset + masterPageSize)
  }, [currentMasterPage, masterPageSize, sortedMasterItems])

  useEffect(() => {
    if (masterPage !== currentMasterPage) {
      setMasterPage(currentMasterPage)
    }
  }, [currentMasterPage, masterPage])

  const itemMatchesFilters = useCallback((item: GroceryItem, filters: ViewFilters) => {
    const normalized = normalizeText(filters.search)
    const listType = listTypeById.get(item.listTypeId)
    const matchesList = filters.listTypeId === 'all' || item.listTypeId === filters.listTypeId
    const matchesFrequency = filters.frequency === 'all' || item.purchaseFrequency === filters.frequency
    const matchesStock = filters.stock === 'all' || (filters.stock === 'yes' ? item.currentStock : !item.currentStock)
    const matchesItem = filters.itemName === 'all' || item.itemName === filters.itemName
    const matchesSearch =
      !normalized ||
      item.itemName.toLowerCase().includes(normalized) ||
      item.itemNumber.toLowerCase().includes(normalized) ||
      item.notes.toLowerCase().includes(normalized) ||
      listType?.listName.toLowerCase().includes(normalized)

    return matchesList && matchesFrequency && matchesStock && matchesItem && matchesSearch
  }, [listTypeById])

  const shopFilteredItems = useMemo(() => {
    return state.groceryItems.filter((item) => itemMatchesFilters(item, shopFilters))
  }, [itemMatchesFilters, shopFilters, state.groceryItems])

  const shoppingLists = useMemo(() => {
    const activeCycles = state.groceryCycles.filter((cycle) => !cycle.isCompleted)
    return activeCycles.map((cycle) => {
      const listType = listTypeById.get(cycle.listTypeId)
      const items = state.shoppingItems.filter((item) => item.cycleId === cycle.id)
      const purchased = items.filter((item) => item.isPurchased).length
      return { cycle, listType, items, purchased }
    })
  }, [listTypeById, state.groceryCycles, state.shoppingItems])

  const shopSubTables = useMemo(() => {
    return state.listTypes.map((listType) => ({
      listType,
      items: shopFilteredItems.filter((item) => item.listTypeId === listType.id),
    }))
  }, [shopFilteredItems, state.listTypes])

  const cycleRows = useMemo(() => {
    const normalized = normalizeText(cycleFilters.search)
    return state.groceryCycles
      .filter((cycle) => {
        const matchesList = cycleFilters.listTypeId === 'all' || cycle.listTypeId === cycleFilters.listTypeId
        const matchesFrequency = cycleFilters.frequency === 'all' || cycle.frequency === cycleFilters.frequency
        return matchesList && matchesFrequency
      })
      .map((cycle) => {
        const listType = listTypeById.get(cycle.listTypeId)
        const listTypeMatchesSearch = Boolean(normalized && listType?.listName.toLowerCase().includes(normalized))
        const items = state.shoppingItems.filter((item) => {
          if (item.cycleId !== cycle.id) return false
          const matchesStock = cycleFilters.stock === 'all' || (cycleFilters.stock === 'yes' ? item.isPurchased : !item.isPurchased)
          const matchesItem = cycleFilters.itemName === 'all' || item.itemName === cycleFilters.itemName
          const matchesSearch =
            !normalized ||
            listTypeMatchesSearch ||
            item.itemName.toLowerCase().includes(normalized) ||
            item.itemNumber.toLowerCase().includes(normalized) ||
            item.notes.toLowerCase().includes(normalized)
          return matchesStock && matchesItem && matchesSearch
        })
        const purchased = items.filter((item) => item.isPurchased).length
        return {
          cycle,
          listType: listTypeById.get(cycle.listTypeId),
          items,
          purchased,
          progress: items.length === 0 ? 0 : Math.round((purchased / items.length) * 100),
        }
      })
      .filter((row) => row.items.length > 0 || (cycleFilters.itemName === 'all' && !normalized && cycleFilters.stock === 'all'))
  }, [cycleFilters, listTypeById, state.groceryCycles, state.shoppingItems])

  const neededItems = state.groceryItems.filter((item) => item.needsPurchase || !item.currentStock)
  const purchasedItems = state.groceryItems.filter((item) => item.purchased)
  const activeCycleCount = state.groceryCycles.filter((cycle) => !cycle.isCompleted).length
  const countActiveFilters = (filters: ViewFilters) => [
    filters.listTypeId !== 'all',
    filters.frequency !== 'all',
    filters.stock !== 'all',
    filters.itemName !== 'all',
    filters.search.trim() !== '',
  ].filter(Boolean).length

  const updateSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const handleAddRow = () => {
    if (!draft.itemName.trim() || state.listTypes.length === 0) return
    addGroceryItem({
      itemName: draft.itemName.trim(),
      listTypeId: draft.listTypeId,
      quantity: Number(draft.quantity) || 1,
      unit: draft.unit,
      purchaseFrequency: draft.purchaseFrequency,
      currentStock: draft.currentStock,
      startDate: draft.startDate || todayIso(),
      notes: draft.notes.trim(),
    })
    setDraft(createEmptyItem(firstListId))
  }

  const startEditingItem = (item: GroceryItem) => {
    setEditingItemId(item.id)
    setEditDraft(toEditDraft(item))
  }

  const saveEdit = (item: GroceryItem) => {
    if (!editDraft || !editDraft.itemName.trim()) return
    const payload: GroceryItemUpdateInput = {
      itemName: editDraft.itemName.trim(),
      listTypeId: editDraft.listTypeId,
      quantity: Number(editDraft.quantity) || 1,
      unit: editDraft.unit,
      purchaseFrequency: editDraft.purchaseFrequency,
      currentStock: editDraft.currentStock,
      startDate: editDraft.startDate || todayIso(),
      notes: editDraft.notes.trim(),
    }
    updateGroceryItem(item.id, payload)
    setEditingItemId(null)
    setEditDraft(null)
  }

  const handleShoppingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!shoppingDraft.itemName.trim()) return
    addShoppingItem({
      ...shoppingDraft,
      itemName: shoppingDraft.itemName.trim(),
      notes: shoppingDraft.notes.trim(),
      quantity: Number(shoppingDraft.quantity) || 1,
    })
    setShoppingDraft((current) => ({ ...current, itemName: '', quantity: 1, notes: '' }))
  }

  const commitPurchasedQuantity = (item: ShoppingCycleItem, rawValue: string) => {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return
    const purchasedQuantity = Math.min(Math.max(parsed, 0), item.quantity)
    setPurchaseDrafts((current) => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
    updateShoppingItem(item.id, { purchasedQuantity })
  }

  const commitRequiredQuantity = (item: ShoppingCycleItem, rawValue: string) => {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return
    const quantity = Math.max(parsed, 0)
    setRequiredDrafts((current) => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
    updateShoppingItem(item.id, { quantity })
  }

  const SortableHeader = ({
    children,
    className,
    sortKey,
  }: {
    children: ReactNode
    className?: string
    sortKey: SortKey
  }) => (
    <th className={cn(tableHeadClass, className)}>
      <button
        className="inline-flex items-center gap-1.5 text-left"
        onClick={() => updateSort(sortKey)}
        type="button"
      >
        {children}
        <ChevronsUpDown className={cn('size-3', sort.key === sortKey ? 'text-indigo-600' : 'text-slate-400')} />
      </button>
    </th>
  )

  const renderColorSwatches = (selected: string, onSelect: (value: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {placeColorOptions.map((option) => (
        <button
          className={cn(
            'flex size-8 items-center justify-center rounded-md border bg-white transition hover:border-indigo-300 hover:bg-indigo-50',
            selected === option.value ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200',
          )}
          key={option.value}
          onClick={() => onSelect(option.value)}
          title={option.label}
          type="button"
        >
          <span className={cn('size-4 rounded-full', option.value)} />
        </button>
      ))}
    </div>
  )

  const renderFilterPanel = (
    filters: ViewFilters,
    updateFilters: (patch: Partial<ViewFilters>) => void,
    resetFilters: () => void,
    searchPlaceholder: string,
    stockLabel = 'Current stock',
    stockAllLabel = 'YES and NO',
    stockYesLabel = 'YES only',
    stockNoLabel = 'NO only',
  ) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1.2fr)_minmax(220px,1.4fr)_auto]">
        <FormField label="Shopping place">
          <select
            className={inputClass}
            onChange={(event) => updateFilters({ listTypeId: event.target.value === 'all' ? 'all' : Number(event.target.value) })}
            value={filters.listTypeId}
          >
            <option value="all">All places</option>
            {state.listTypes.map((listType) => (
              <option key={listType.id} value={listType.id}>{listType.listName}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Purchase frequency">
          <select
            className={inputClass}
            onChange={(event) => updateFilters({ frequency: event.target.value as Frequency | 'all' })}
            value={filters.frequency}
          >
            <option value="all">All cycles</option>
            {frequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={stockLabel}>
          <select
            className={inputClass}
            onChange={(event) => updateFilters({ stock: event.target.value as StockFilter })}
            value={filters.stock}
          >
            <option value="all">{stockAllLabel}</option>
            <option value="yes">{stockYesLabel}</option>
            <option value="no">{stockNoLabel}</option>
          </select>
        </FormField>
        <FormField label="Item menu">
          <select
            className={inputClass}
            onChange={(event) => updateFilters({ itemName: event.target.value })}
            value={filters.itemName}
          >
            <option value="all">All items</option>
            {itemNameOptions.map((itemName) => (
              <option key={itemName} value={itemName}>{itemName}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Search">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              className={cn(inputClass, 'pl-10')}
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder={searchPlaceholder}
              value={filters.search}
            />
          </div>
        </FormField>
        <div className="flex items-end">
          <Button className="w-full" onClick={resetFilters} variant="secondary">
            <X className="size-4" aria-hidden="true" />
            Reset {countActiveFilters(filters) > 0 ? `(${countActiveFilters(filters)})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Grocery Management</h2>
          <p className="mt-1 text-sm text-slate-400">Editable master list, shopping places, purchase cycles, and shop sub-tables</p>
        </div>
        <Button
          disabled={!canManageGroceries}
          onClick={() => {
            if (window.confirm('Regenerate grocery cycles from the current master list?')) {
              regenerateGroceryCycles()
            }
          }}
          variant="secondary"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Regenerate cycles
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-rose-100/70 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50">
              <AlertTriangle className="size-5 text-rose-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Needs purchase</p>
              <p className="text-xl font-bold text-slate-900">{neededItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100/70 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
              <PackageCheck className="size-5 text-emerald-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Purchased</p>
              <p className="text-xl font-bold text-slate-900">{purchasedItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-100/70 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-50">
              <Store className="size-5 text-sky-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Shopping places</p>
              <p className="text-xl font-bold text-slate-900">{state.listTypes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-indigo-100/70 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50">
              <ShoppingBasket className="size-5 text-indigo-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Active cycles</p>
              <p className="text-xl font-bold text-slate-900">{activeCycleCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
            tab === 'master' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('master')}
          type="button"
        >
          <List className="size-4" aria-hidden="true" />
          Master List
        </button>
        <button
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
            tab === 'shopping' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('shopping')}
          type="button"
        >
          <ShoppingCart className="size-4" aria-hidden="true" />
          Shopping Lists
          {shoppingLists.length > 0 && <Badge tone="indigo">{shoppingLists.length}</Badge>}
        </button>
        <button
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
            tab === 'places' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('places')}
          type="button"
        >
          <Store className="size-4" aria-hidden="true" />
          Shopping Places
          <Badge tone="slate">{state.listTypes.length}</Badge>
        </button>
        <button
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
            tab === 'cycles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('cycles')}
          type="button"
        >
          <ShoppingBasket className="size-4" aria-hidden="true" />
          Purchase Cycles
          {cycleRows.length > 0 && <Badge tone="teal">{cycleRows.length}</Badge>}
        </button>
      </div>

      {tab === 'master' && (
        <div className="grid gap-5">
          <div className="grid min-w-0 gap-5">
            <div className="grid min-w-0 gap-5">
              <Card className="min-w-0 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle>Grocery Master List</CardTitle>
                    <p className="mt-1 text-xs text-slate-400">
                      {state.groceryItems.length} rows. Item numbers are generated automatically.
                    </p>
                  </div>
                  <Badge icon={<Filter className="size-3" aria-hidden="true" />} tone="indigo">
                    Sortable master
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-0 text-left">
                      <thead>
                        <tr>
                          <th className={cn(tableHeadClass, 'w-[45px]')}>S.No</th>
                          <SortableHeader className="w-[105px]" sortKey="listType">List type</SortableHeader>
                          <SortableHeader className="w-[90px]" sortKey="itemNumber">Item no.</SortableHeader>
                          <SortableHeader className="w-[125px]" sortKey="itemName">Item name</SortableHeader>
                          <SortableHeader className="w-[110px]" sortKey="quantity">Item qty</SortableHeader>
                          <SortableHeader className="w-[125px]" sortKey="purchaseFrequency">Purchase frequency</SortableHeader>
                          <SortableHeader className="w-[95px]" sortKey="currentStock">Current stock</SortableHeader>
                          <SortableHeader className="w-[95px]" sortKey="startDate">Start date</SortableHeader>
                          <th className={cn(tableHeadClass, 'w-[105px]')}>Notes</th>
                          <th className={cn(tableHeadClass, 'sticky right-0 z-10 w-[105px] text-right shadow-[-8px_0_12px_rgb(15_23_42/0.04)]')}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canManageGroceries && (
                          <tr className="bg-emerald-50/50">
                            <td className={tableCellClass}>New</td>
                            <td className={tableCellClass}>
                              <select
                                className={cellSelectClass}
                                onChange={(event) => setDraft((current) => ({ ...current, listTypeId: Number(event.target.value) }))}
                                value={draft.listTypeId}
                              >
                                {state.listTypes.map((listType) => (
                                  <option key={listType.id} value={listType.id}>{listType.listName}</option>
                                ))}
                              </select>
                            </td>
                            <td className={cn(tableCellClass, 'font-semibold text-slate-400')}>Auto</td>
                            <td className={tableCellClass}>
                              <input
                                className={cellInputClass}
                                onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
                                placeholder="Item name"
                                value={draft.itemName}
                              />
                            </td>
                            <td className={tableCellClass}>
                              <div className="grid grid-cols-[minmax(0,1fr)_60px] gap-2">
                                <input
                                  className={cellInputClass}
                                  min="0.01"
                                  onChange={(event) => setDraft((current) => ({ ...current, quantity: Number(event.target.value) }))}
                                  step="0.5"
                                  type="number"
                                  value={draft.quantity}
                                />
                                <select
                                  className={cellSelectClass}
                                  onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
                                  value={draft.unit}
                                >
                                  {unitOptions.map((unit) => (
                                    <option key={unit} value={unit}>{unit}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className={tableCellClass}>
                              <select
                                className={cellSelectClass}
                                onChange={(event) =>
                                  setDraft((current) => ({ ...current, purchaseFrequency: event.target.value as Frequency }))
                                }
                                value={draft.purchaseFrequency}
                              >
                                {frequencyOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className={tableCellClass}>
                              <select
                                className={cellSelectClass}
                                onChange={(event) => setDraft((current) => ({ ...current, currentStock: event.target.value === 'yes' }))}
                                value={draft.currentStock ? 'yes' : 'no'}
                              >
                                <option value="yes">YES</option>
                                <option value="no">NO</option>
                              </select>
                            </td>
                            <td className={tableCellClass}>
                              <input
                                className={cellInputClass}
                                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                                type="date"
                                value={draft.startDate}
                              />
                            </td>
                            <td className={tableCellClass}>
                              <input
                                className={cellInputClass}
                                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                                placeholder="Notes"
                                value={draft.notes}
                              />
                            </td>
                            <td className={cn(tableCellClass, 'sticky right-0 bg-emerald-50 text-right shadow-[-8px_0_12px_rgb(15_23_42/0.04)]')}>
                              <Button className="min-h-9 px-3 py-1.5 text-xs" onClick={handleAddRow}>
                                <Plus className="size-3.5" aria-hidden="true" />
                                Add
                              </Button>
                            </td>
                          </tr>
                        )}

                        {sortedMasterItems.length === 0 ? (
                          <tr>
                            <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={10}>
                              No grocery rows are available.
                            </td>
                          </tr>
                        ) : (
                          paginatedMasterItems.map((item, index) => {
                            const listType = listTypeById.get(item.listTypeId)
                            const isEditing = editingItemId === item.id && editDraft

                            return (
                              <tr className="bg-white transition hover:bg-slate-50/80" key={item.id}>
                                <td className={cn(tableCellClass, 'font-semibold text-slate-500')}>{currentMasterPage * masterPageSize + index + 1}</td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <select
                                      className={cellSelectClass}
                                      onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, listTypeId: Number(event.target.value) } : current)
                                      }
                                      value={editDraft.listTypeId}
                                    >
                                      {state.listTypes.map((option) => (
                                        <option key={option.id} value={option.id}>{option.listName}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="inline-flex items-center gap-2">
                                      <span className={cn('size-2.5 rounded-full', listType?.colorClass)} />
                                      <span className="font-semibold text-slate-800">{listType?.listName ?? 'Unknown'}</span>
                                    </span>
                                  )}
                                </td>
                                <td className={cn(tableCellClass, 'font-mono font-semibold text-slate-600')}>{item.itemNumber}</td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <input
                                      className={cellInputClass}
                                      onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, itemName: event.target.value } : current)
                                      }
                                      value={editDraft.itemName}
                                    />
                                  ) : (
                                    <span className="font-semibold text-slate-900">{item.itemName}</span>
                                  )}
                                </td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <div className="grid grid-cols-[minmax(0,1fr)_60px] gap-2">
                                      <input
                                        className={cellInputClass}
                                        min="0.01"
                                        onChange={(event) =>
                                          setEditDraft((current) => current ? { ...current, quantity: Number(event.target.value) } : current)
                                        }
                                        step="0.5"
                                        type="number"
                                        value={editDraft.quantity}
                                      />
                                      <select
                                        className={cellSelectClass}
                                        onChange={(event) =>
                                          setEditDraft((current) => current ? { ...current, unit: event.target.value } : current)
                                        }
                                        value={editDraft.unit}
                                      >
                                        {unitOptions.map((unit) => (
                                          <option key={unit} value={unit}>{unit}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <span>{item.quantity} {item.unit}</span>
                                  )}
                                </td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <select
                                      className={cellSelectClass}
                                      onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, purchaseFrequency: event.target.value as Frequency } : current)
                                      }
                                      value={editDraft.purchaseFrequency}
                                    >
                                      {frequencyOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <Badge tone={frequencyTone(item.purchaseFrequency)}>{frequencyLabel(item.purchaseFrequency)}</Badge>
                                  )}
                                </td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <select
                                      className={cellSelectClass}
                                      onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, currentStock: event.target.value === 'yes' } : current)
                                      }
                                      value={editDraft.currentStock ? 'yes' : 'no'}
                                    >
                                      <option value="yes">YES</option>
                                      <option value="no">NO</option>
                                    </select>
                                  ) : (
                                    <button
                                      className={cn(
                                        'inline-flex min-h-7 items-center rounded-md border px-2.5 text-[11px] font-bold transition',
                                        item.currentStock
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-rose-200 bg-rose-50 text-rose-700',
                                      )}
                                      disabled={!canManageGroceries}
                                      onClick={() => toggleCurrentStock(item.id)}
                                      type="button"
                                    >
                                      {item.currentStock ? 'YES' : 'NO'}
                                    </button>
                                  )}
                                </td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <input
                                      className={cellInputClass}
                                      onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, startDate: event.target.value } : current)
                                      }
                                      type="date"
                                      value={editDraft.startDate}
                                    />
                                  ) : (
                                    <span>{formatCompactDate(item.startDate)}</span>
                                  )}
                                </td>
                                <td className={tableCellClass}>
                                  {isEditing ? (
                                    <input
                                      className={cellInputClass}
                                      onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, notes: event.target.value } : current)
                                      }
                                      value={editDraft.notes}
                                    />
                                  ) : (
                                    <span className="line-clamp-2 text-slate-500">{item.notes || '-'}</span>
                                  )}
                                </td>
                                <td className={cn(tableCellClass, 'sticky right-0 bg-white text-right shadow-[-8px_0_12px_rgb(15_23_42/0.04)]')}>
                                  {isEditing ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        className="flex size-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                        onClick={() => saveEdit(item)}
                                        title="Save row"
                                        type="button"
                                      >
                                        <Check className="size-4" aria-hidden="true" />
                                      </button>
                                      <button
                                        className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                                        onClick={() => { setEditingItemId(null); setEditDraft(null) }}
                                        title="Cancel edit"
                                        type="button"
                                      >
                                        <X className="size-4" aria-hidden="true" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                        disabled={!canManageGroceries}
                                        onClick={() => startEditingItem(item)}
                                        title="Edit row"
                                        type="button"
                                      >
                                        <Edit3 className="size-3.5" aria-hidden="true" />
                                      </button>
                                      <button
                                        className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                        disabled={!canManageGroceries}
                                        onClick={() => toggleGroceryPurchased(item.id)}
                                        title="Mark purchased"
                                        type="button"
                                      >
                                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                      </button>
                                      <button
                                        className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                        disabled={!canManageGroceries}
                                        onClick={() => { if (window.confirm(`Delete ${item.itemName}?`)) deleteGroceryItem(item.id) }}
                                        title="Delete row"
                                        type="button"
                                      >
                                        <Trash2 className="size-3.5" aria-hidden="true" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                    <span>
                      Showing {sortedMasterItems.length === 0 ? 0 : currentMasterPage * masterPageSize + 1}
                      {' - '}
                      {Math.min((currentMasterPage + 1) * masterPageSize, sortedMasterItems.length)}
                      {' of '}
                      {sortedMasterItems.length}
                    </span>
                    <label className="inline-flex items-center gap-2">
                      Rows
                      <select
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        onChange={(event) => {
                          setMasterPageSize(Number(event.target.value))
                          setMasterPage(0)
                        }}
                        value={masterPageSize}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={currentMasterPage === 0}
                      onClick={() => setMasterPage((page) => Math.max(0, page - 1))}
                      variant="secondary"
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-semibold text-slate-500">
                      Page {currentMasterPage + 1} of {totalMasterPages}
                    </span>
                    <Button
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={currentMasterPage >= totalMasterPages - 1}
                      onClick={() => setMasterPage((page) => Math.min(totalMasterPages - 1, page + 1))}
                      variant="secondary"
                    >
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Shop Sub-Tables</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Each shopping place below follows the same filters, item menu, and frequency selection</p>
              </div>
              <Badge tone="teal">Filtered views</Badge>
            </CardHeader>
            <CardContent>
              {renderFilterPanel(
                shopFilters,
                (patch) => setShopFilters((current) => ({ ...current, ...patch })),
                () => setShopFilters(defaultViewFilters),
                'Search number, item, place, note',
              )}
            </CardContent>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {shopSubTables.map(({ items, listType }) => (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" key={listType.id}>
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2.5 rounded-full', listType.colorClass)} />
                      <h3 className="text-sm font-bold text-slate-900">{listType.listName}</h3>
                    </div>
                    <Badge tone="slate">{items.length} rows</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left">
                      <thead>
                        <tr>
                          <th className={tableHeadClass}>Item</th>
                          <th className={tableHeadClass}>Item no.</th>
                          <th className={tableHeadClass}>Qty</th>
                          <th className={tableHeadClass}>Frequency</th>
                          <th className={tableHeadClass}>Stock</th>
                          <th className={tableHeadClass}>Start date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td className="px-4 py-8 text-center text-xs text-slate-500" colSpan={6}>
                              No rows under current filters.
                            </td>
                          </tr>
                        ) : (
                          items.map((item) => (
                            <tr key={item.id}>
                              <td className={cn(tableCellClass, 'font-semibold text-slate-900')}>{item.itemName}</td>
                              <td className={cn(tableCellClass, 'font-mono')}>{item.itemNumber}</td>
                              <td className={tableCellClass}>{item.quantity} {item.unit}</td>
                              <td className={tableCellClass}>
                                <Badge tone={frequencyTone(item.purchaseFrequency)}>{frequencyLabel(item.purchaseFrequency)}</Badge>
                              </td>
                              <td className={tableCellClass}>
                                <Badge tone={item.currentStock ? 'green' : 'rose'}>{item.currentStock ? 'YES' : 'NO'}</Badge>
                              </td>
                              <td className={tableCellClass}>{formatCompactDate(item.startDate)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'shopping' && (
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Current Shopping Trip</CardTitle>
                <p className="mt-1 text-xs text-slate-400">
                  {state.shoppingItems.length} active rows across {shoppingLists.length} list{shoppingLists.length === 1 ? '' : 's'}
                </p>
              </div>
              <Button onClick={() => void buildShoppingList()} variant="secondary">
                <RefreshCw className="size-4" aria-hidden="true" />
                Build now
              </Button>
            </CardHeader>
            {canManageGroceries && (
              <CardContent>
                <form onSubmit={handleShoppingSubmit}>
                  <fieldset
                    className="m-0 grid gap-3 border-0 p-0 lg:grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_150px_100px_110px_minmax(160px,1fr)_auto]"
                    disabled={state.listTypes.length === 0}
                  >
                    <FormField label="Item">
                      <input
                        className={inputClass}
                        onChange={(event) => setShoppingDraft((current) => ({ ...current, itemName: event.target.value }))}
                        placeholder="Add to this trip"
                        value={shoppingDraft.itemName}
                      />
                    </FormField>
                    <FormField label="List">
                      <select
                        className={inputClass}
                        onChange={(event) => setShoppingDraft((current) => ({ ...current, listTypeId: Number(event.target.value) }))}
                        value={shoppingDraft.listTypeId}
                      >
                        {state.listTypes.map((listType) => (
                          <option key={listType.id} value={listType.id}>{listType.listName}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Cycle">
                      <select
                        className={inputClass}
                        onChange={(event) =>
                          setShoppingDraft((current) => ({ ...current, purchaseFrequency: event.target.value as Frequency }))
                        }
                        value={shoppingDraft.purchaseFrequency}
                      >
                        {frequencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Qty">
                      <input
                        className={inputClass}
                        min="0.01"
                        onChange={(event) => setShoppingDraft((current) => ({ ...current, quantity: Number(event.target.value) }))}
                        step="0.5"
                        type="number"
                        value={shoppingDraft.quantity}
                      />
                    </FormField>
                    <FormField label="Unit">
                      <select
                        className={inputClass}
                        onChange={(event) => setShoppingDraft((current) => ({ ...current, unit: event.target.value }))}
                        value={shoppingDraft.unit}
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Notes">
                      <input
                        className={inputClass}
                        onChange={(event) => setShoppingDraft((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Brand, size, replacement"
                        value={shoppingDraft.notes}
                      />
                    </FormField>
                    <div className="flex items-end">
                      <Button className="w-full" type="submit">
                        <Plus className="size-4" aria-hidden="true" />
                        Add
                      </Button>
                    </div>
                  </fieldset>
                </form>
              </CardContent>
            )}
          </Card>

          {shoppingLists.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingCart className="mx-auto size-12 text-slate-200" aria-hidden="true" />
                <p className="mt-4 text-sm font-semibold text-slate-600">No active shopping rows are available</p>
              </CardContent>
            </Card>
          ) : (
            shoppingLists.map(({ cycle, items, listType, purchased }) => {
              const progress = items.length === 0 ? 0 : Math.round((purchased / items.length) * 100)
              const partial = items.filter((item) => item.purchasedQuantity > 0 && !item.isPurchased).length
              const allDone = purchased === items.length && items.length > 0

              return (
                <Card key={cycle.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className={cn('size-3 rounded-full', listType?.colorClass)} />
                        {listType?.listName} - {frequencyLabel(cycle.frequency)}
                      </CardTitle>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatCompactDate(cycle.cycleStartDate)} - {formatCompactDate(cycle.cycleEndDate)}
                        {' - '}{purchased} of {items.length} purchased
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {allDone && <Badge tone="green">Complete</Badge>}
                      {partial > 0 && <Badge tone="amber">{partial} partial</Badge>}
                      <Badge tone="teal">{progress}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] text-left">
                        <thead>
                          <tr>
                            <th className={tableHeadClass}>Done</th>
                            <th className={tableHeadClass}>Item</th>
                            <th className={tableHeadClass}>Item no.</th>
                            <th className={tableHeadClass}>Need</th>
                            <th className={tableHeadClass}>Bought</th>
                            <th className={tableHeadClass}>Unit</th>
                            <th className={tableHeadClass}>Notes</th>
                            <th className={tableHeadClass}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr className={cn(item.isPurchased ? 'bg-emerald-50/40' : 'bg-white hover:bg-slate-50')} key={item.id}>
                              <td className={tableCellClass}>
                                <input
                                  checked={item.isPurchased}
                                  className="size-4 rounded border-slate-300 text-emerald-600"
                                  disabled={!canManageGroceries}
                                  onChange={() => updateShoppingItem(item.id, { isPurchased: !item.isPurchased })}
                                  type="checkbox"
                                />
                              </td>
                              <td className={cn(tableCellClass, 'font-semibold text-slate-900')}>
                                <span className={cn(item.isPurchased && 'text-slate-400 line-through')}>{item.itemName}</span>
                                <span className="ml-2 inline-flex gap-1">
                                  {item.isAdhoc && <Badge tone="indigo">Added</Badge>}
                                  {item.carriedForward && <Badge tone="amber">Carry</Badge>}
                                </span>
                              </td>
                              <td className={cn(tableCellClass, 'font-mono')}>{item.itemNumber}</td>
                              <td className={tableCellClass}>
                                <input
                                  aria-label={`Need ${item.itemName}`}
                                  className={cellInputClass}
                                  disabled={!canManageGroceries}
                                  min="0"
                                  onBlur={(event) => commitRequiredQuantity(item, event.currentTarget.value)}
                                  onChange={(event) => setRequiredDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      event.currentTarget.blur()
                                    }
                                  }}
                                  step="0.5"
                                  type="number"
                                  value={requiredDrafts[item.id] ?? String(item.quantity)}
                                />
                              </td>
                              <td className={tableCellClass}>
                                <input
                                  aria-label={`Bought ${item.itemName}`}
                                  className={cellInputClass}
                                  disabled={!canManageGroceries}
                                  max={item.quantity}
                                  min="0"
                                  onBlur={(event) => commitPurchasedQuantity(item, event.currentTarget.value)}
                                  onChange={(event) => setPurchaseDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      event.currentTarget.blur()
                                    }
                                  }}
                                  step="0.5"
                                  type="number"
                                  value={purchaseDrafts[item.id] ?? String(item.purchasedQuantity)}
                                />
                              </td>
                              <td className={tableCellClass}>{item.unit}</td>
                              <td className={tableCellClass}>{item.notes || '-'}</td>
                              <td className={tableCellClass}>
                                <Badge tone={item.isPurchased ? 'green' : item.purchasedQuantity > 0 ? 'amber' : 'slate'}>
                                  {item.isPurchased ? 'Done' : item.purchasedQuantity > 0 ? 'Partial' : 'Open'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {tab === 'places' && (
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Shopping Places</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Manage Wet Market, Super Market, Murugan, NTUC, and other grocery sources</p>
              </div>
              {canManageGroceries && (
                <Button onClick={() => setShowAddPlace((current) => !current)} variant="secondary">
                  {showAddPlace ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                  {showAddPlace ? 'Cancel' : 'Add place'}
                </Button>
              )}
            </CardHeader>

            {showAddPlace && canManageGroceries && (
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!newPlace.name.trim()) return
                    addListType(newPlace.name.trim(), newPlace.description.trim(), newPlace.color)
                    setNewPlace({ name: '', description: '', color: 'bg-slate-500' })
                    setShowAddPlace(false)
                  }}
                >
                  <fieldset className="m-0 grid gap-3 border-0 p-0 lg:grid-cols-[minmax(180px,1fr)_minmax(240px,1.4fr)_minmax(220px,1fr)_auto]">
                    <FormField label="Place name">
                      <input
                        className={inputClass}
                        onChange={(event) => setNewPlace((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Example: Mustafa"
                        value={newPlace.name}
                      />
                    </FormField>
                    <FormField label="Description">
                      <input
                        className={inputClass}
                        onChange={(event) => setNewPlace((current) => ({ ...current, description: event.target.value }))}
                        placeholder="What this place is used for"
                        value={newPlace.description}
                      />
                    </FormField>
                    <FormField label="Color">
                      {renderColorSwatches(newPlace.color, (color) => setNewPlace((current) => ({ ...current, color })))}
                    </FormField>
                    <div className="flex items-end">
                      <Button className="w-full" type="submit">
                        <Plus className="size-4" aria-hidden="true" />
                        Add
                      </Button>
                    </div>
                  </fieldset>
                </form>
              </CardContent>
            )}

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>Place</th>
                      <th className={tableHeadClass}>Description</th>
                      <th className={tableHeadClass}>Items</th>
                      <th className={tableHeadClass}>Color</th>
                      <th className={cn(tableHeadClass, 'text-right')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.listTypes.length === 0 ? (
                      <tr>
                        <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={5}>
                          No shopping places are available.
                        </td>
                      </tr>
                    ) : (
                      state.listTypes.map((listType) => {
                        const itemCount = itemCountByListType.get(listType.id) ?? 0
                        const isEditingPlace = editingPlaceId === listType.id

                        return (
                          <tr className="bg-white transition hover:bg-slate-50/80" key={listType.id}>
                            <td className={tableCellClass}>
                              {isEditingPlace ? (
                                <input
                                  className={cellInputClass}
                                  onChange={(event) => setPlaceEdit((current) => ({ ...current, listName: event.target.value }))}
                                  value={placeEdit.listName}
                                />
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <span className={cn('size-2.5 rounded-full', listType.colorClass)} />
                                  <span className="font-semibold text-slate-900">{listType.listName}</span>
                                </span>
                              )}
                            </td>
                            <td className={tableCellClass}>
                              {isEditingPlace ? (
                                <input
                                  className={cellInputClass}
                                  onChange={(event) => setPlaceEdit((current) => ({ ...current, description: event.target.value }))}
                                  value={placeEdit.description}
                                />
                              ) : (
                                <span>{listType.description || '-'}</span>
                              )}
                            </td>
                            <td className={tableCellClass}>
                              <Badge tone={itemCount > 0 ? 'indigo' : 'slate'}>{itemCount} item{itemCount === 1 ? '' : 's'}</Badge>
                            </td>
                            <td className={tableCellClass}>
                              {isEditingPlace ? (
                                renderColorSwatches(placeEdit.colorClass, (colorClass) =>
                                  setPlaceEdit((current) => ({ ...current, colorClass })),
                                )
                              ) : (
                                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                                  <span className={cn('size-4 rounded-full', listType.colorClass)} />
                                  {listType.colorClass.replace('bg-', '')}
                                </span>
                              )}
                            </td>
                            <td className={cn(tableCellClass, 'text-right')}>
                              {isEditingPlace ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    className="flex size-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                    disabled={!canManageGroceries}
                                    onClick={() => {
                                      if (!placeEdit.listName.trim()) return
                                      updateListType(listType.id, {
                                        listName: placeEdit.listName.trim(),
                                        description: placeEdit.description.trim(),
                                        colorClass: placeEdit.colorClass || 'bg-slate-500',
                                      })
                                      setEditingPlaceId(null)
                                    }}
                                    title="Save place"
                                    type="button"
                                  >
                                    <Check className="size-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                                    onClick={() => setEditingPlaceId(null)}
                                    title="Cancel edit"
                                    type="button"
                                  >
                                    <X className="size-4" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                    disabled={!canManageGroceries}
                                    onClick={() => {
                                      setEditingPlaceId(listType.id)
                                      setPlaceEdit({
                                        listName: listType.listName,
                                        description: listType.description,
                                        colorClass: listType.colorClass,
                                      })
                                    }}
                                    title="Edit place"
                                    type="button"
                                  >
                                    <Edit3 className="size-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500"
                                    disabled={!canManageGroceries || itemCount > 0}
                                    onClick={() => {
                                      if (window.confirm(`Delete ${listType.listName}?`)) deleteListType(listType.id)
                                    }}
                                    title={itemCount > 0 ? 'Remove grocery items before deleting this place' : 'Delete place'}
                                    type="button"
                                  >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'cycles' && (
        <div className="grid gap-5">
          {renderFilterPanel(
            cycleFilters,
            (patch) => setCycleFilters((current) => ({ ...current, ...patch })),
            () => setCycleFilters(defaultViewFilters),
            'Search place, item, number, note',
            'Purchase status',
            'Done and open',
            'Done only',
            'Open only',
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Purchase Cycles</CardTitle>
                <p className="mt-1 text-xs text-slate-400">
                  {cycleRows.length} cycle{cycleRows.length === 1 ? '' : 's'} shown after filters
                </p>
              </div>
              <Button
                disabled={!canManageGroceries}
                onClick={() => {
                  if (window.confirm('Regenerate grocery cycles from the current master list?')) {
                    regenerateGroceryCycles()
                  }
                }}
                variant="secondary"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Regenerate
              </Button>
            </CardHeader>
            <CardContent>
              {cycleRows.length === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingBasket className="mx-auto size-12 text-slate-200" aria-hidden="true" />
                  <p className="mt-4 text-sm font-semibold text-slate-600">No purchase cycles match the current filters</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {cycleRows.map(({ cycle, items, listType, progress, purchased }) => (
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" key={cycle.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <span className={cn('size-2.5 rounded-full', listType?.colorClass)} />
                            {listType?.listName ?? 'Unknown'} - {frequencyLabel(cycle.frequency)}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatCompactDate(cycle.cycleStartDate)} - {formatCompactDate(cycle.cycleEndDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={cycle.isCompleted ? 'green' : 'indigo'}>{cycle.isCompleted ? 'Completed' : 'Active'}</Badge>
                          <Badge tone="teal">{progress}%</Badge>
                          <Badge tone="slate">{purchased} of {items.length} done</Badge>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left">
                          <thead>
                            <tr>
                              <th className={tableHeadClass}>Item</th>
                              <th className={tableHeadClass}>Item no.</th>
                              <th className={tableHeadClass}>Need</th>
                              <th className={tableHeadClass}>Bought</th>
                              <th className={tableHeadClass}>Unit</th>
                              <th className={tableHeadClass}>Status</th>
                              <th className={tableHeadClass}>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.length === 0 ? (
                              <tr>
                                <td className="px-4 py-8 text-center text-xs text-slate-500" colSpan={7}>
                                  No rows under current filters.
                                </td>
                              </tr>
                            ) : (
                              items.map((item) => (
                                <tr className={item.isPurchased ? 'bg-emerald-50/40' : 'bg-white'} key={item.id}>
                                  <td className={cn(tableCellClass, 'font-semibold text-slate-900')}>{item.itemName}</td>
                                  <td className={cn(tableCellClass, 'font-mono')}>{item.itemNumber}</td>
                                  <td className={tableCellClass}>{item.quantity}</td>
                                  <td className={tableCellClass}>{item.purchasedQuantity}</td>
                                  <td className={tableCellClass}>{item.unit}</td>
                                  <td className={tableCellClass}>
                                    <Badge tone={item.isPurchased ? 'green' : item.purchasedQuantity > 0 ? 'amber' : 'slate'}>
                                      {item.isPurchased ? 'Done' : item.purchasedQuantity > 0 ? 'Partial' : 'Open'}
                                    </Badge>
                                  </td>
                                  <td className={tableCellClass}>{item.notes || '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
