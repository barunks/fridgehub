import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  List,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { Frequency, NewGroceryItemInput } from '@/types/familyHub'
import { formatCompactDate } from '@/utils/date'
import { cn } from '@/utils/style'

const frequencyOptions: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly']
const unitOptions = ['Kg', 'Lt', 'Units', 'Pack', 'Dozen', 'Bottle', 'Bunch']

const emptyItem: NewGroceryItemInput = {
  itemName: '',
  listTypeId: 1,
  quantity: 1,
  unit: 'Units',
  purchaseFrequency: 'weekly',
  currentStock: false,
  notes: '',
}

type Tab = 'master' | 'shopping'

export const GroceryView = ({ store }: { store: FamilyHubStore }) => {
  const { state, addGroceryItem, addListType, loadGroceryPage, regenerateGroceryCycles, toggleCurrentStock, toggleGroceryPurchased } = store
  const canManageGroceries = store.can('manage_groceries')
  const page = store.pagination.groceryItems
  const pageItems = store.paged.groceryItems ?? state.groceryItems
  const [tab, setTab] = useState<Tab>('master')
  const [selectedListId, setSelectedListId] = useState<number | 'all'>('all')
  const [frequency, setFrequency] = useState<Frequency | 'all'>('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<NewGroceryItemInput>(emptyItem)
  const [newPlace, setNewPlace] = useState({ name: '', description: '', color: 'bg-slate-500' })
  const [showAddPlace, setShowAddPlace] = useState(false)

  useEffect(() => {
    loadGroceryPage(0, selectedListId)
  }, [loadGroceryPage, selectedListId])

  const filteredItems = useMemo(() => {
    const normalized = search.toLowerCase().trim()
    return pageItems.filter((item) => {
      const matchesList = selectedListId === 'all' || item.listTypeId === selectedListId
      const matchesFrequency = frequency === 'all' || item.purchaseFrequency === frequency
      const matchesSearch =
        !normalized ||
        item.itemName.toLowerCase().includes(normalized) ||
        item.notes.toLowerCase().includes(normalized) ||
        item.itemNumber.toLowerCase().includes(normalized)
      return matchesList && matchesFrequency && matchesSearch
    })
  }, [frequency, pageItems, search, selectedListId])

  const shoppingLists = useMemo(() => {
    const activeCycles = state.groceryCycles.filter((cycle) => !cycle.isCompleted)
    return activeCycles.map((cycle) => {
      const listType = state.listTypes.find((lt) => lt.id === cycle.listTypeId)
      const items = state.groceryItems.filter(
        (item) => item.listTypeId === cycle.listTypeId && item.purchaseFrequency === cycle.frequency,
      )
      const purchased = items.filter((item) => item.purchased).length
      return { cycle, listType, items, purchased }
    })
  }, [state.groceryCycles, state.groceryItems, state.listTypes])

  const neededItems = state.groceryItems.filter((item) => item.needsPurchase || !item.currentStock)
  const purchasedItems = state.groceryItems.filter((item) => item.purchased)
  const activeCycleCount = state.groceryCycles.filter((cycle) => !cycle.isCompleted).length

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.itemName.trim()) return
    addGroceryItem({
      ...draft,
      itemName: draft.itemName.trim(),
      notes: draft.notes.trim(),
      quantity: Number(draft.quantity) || 1,
    })
    setDraft(emptyItem)
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Grocery Management</h2>
          <p className="mt-1 text-sm text-slate-400">Master list, purchase cycles, and shopping sub-lists</p>
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

      {/* Hero KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="group overflow-hidden border-rose-100/60 bg-gradient-to-br from-rose-50 to-white">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-100 transition-transform duration-200 group-hover:scale-110">
              <AlertTriangle className="size-5 text-rose-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-rose-600/80">Needs purchase</p>
              <p className="text-2xl font-bold text-slate-900">{neededItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="group overflow-hidden border-emerald-100/60 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 transition-transform duration-200 group-hover:scale-110">
              <PackageCheck className="size-5 text-emerald-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600/80">Purchased</p>
              <p className="text-2xl font-bold text-slate-900">{purchasedItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="group overflow-hidden border-indigo-100/60 bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-100 transition-transform duration-200 group-hover:scale-110">
              <Store className="size-5 text-indigo-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-indigo-600/80">Active cycles</p>
              <p className="text-2xl font-bold text-slate-900">{activeCycleCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-1.5 backdrop-blur-sm">
        <button
          className={cn(
            'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200',
            tab === 'master' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
          )}
          onClick={() => setTab('master')}
          type="button"
        >
          <List className="size-4" aria-hidden="true" />
          Master List
        </button>
        <button
          className={cn(
            'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200',
            tab === 'shopping' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
          )}
          onClick={() => setTab('shopping')}
          type="button"
        >
          <ShoppingCart className="size-4" aria-hidden="true" />
          Shopping Lists
          {shoppingLists.length > 0 && <Badge tone="indigo">{shoppingLists.length}</Badge>}
        </button>
      </div>

      {tab === 'master' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5">
            <Card>
              <CardContent className="grid gap-3 lg:grid-cols-[220px_180px_minmax(0,1fr)]">
                <FormField label="List type">
                  <select
                    className={inputClass}
                    onChange={(event) =>
                      setSelectedListId(event.target.value === 'all' ? 'all' : Number(event.target.value))
                    }
                    value={selectedListId}
                  >
                    <option value="all">All lists</option>
                    {state.listTypes.map((listType) => (
                      <option key={listType.id} value={listType.id}>{listType.listName}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Frequency">
                  <select
                    className={inputClass}
                    onChange={(event) => setFrequency(event.target.value as Frequency | 'all')}
                    value={frequency}
                  >
                    <option value="all">All cycles</option>
                    {frequencyOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
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
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search item, number, or note"
                      value={search}
                    />
                  </div>
                </FormField>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Grocery Master List</CardTitle>
                  <p className="mt-1 text-xs text-slate-400">
                    {filteredItems.length} items - sub-lists auto-generate per cycle
                  </p>
                </div>
                <Badge tone="indigo">Master list</Badge>
              </CardHeader>
              <CardContent className="grid gap-5">
                {filteredItems.length === 0 ? (
                  <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center">
                    <div>
                      <ShoppingBasket className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-slate-600">No grocery items match this view</p>
                    </div>
                  </div>
                ) : (
                  <div className="stagger-children grid gap-4 sm:grid-cols-2">
                    {filteredItems.map((item) => {
                      const listType = state.listTypes.find((lt) => lt.id === item.listTypeId)
                      return (
                        <article className={cn('hover-card flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm', item.expiryDate && !item.currentStock && 'expiry-ring')} key={item.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn('size-2.5 rounded-full', listType?.colorClass)} />
                                <p className="text-[11px] font-semibold uppercase text-slate-400">{item.itemNumber}</p>
                              </div>
                              <h4 className="mt-1.5 truncate text-base font-bold text-slate-900">{item.itemName}</h4>
                            </div>
                            <button
                              className={cn(
                                'soft-pill shrink-0 px-3 py-1 text-[11px] font-bold transition-all',
                                item.currentStock
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-rose-200 bg-rose-50 text-rose-700 pulse-urgent',
                              )}
                              disabled={!canManageGroceries}
                              onClick={() => toggleCurrentStock(item.id)}
                              type="button"
                            >
                              {item.currentStock ? 'In stock' : 'Needed'}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Badge tone={item.purchaseFrequency === 'weekly' ? 'green' : 'amber'}>{item.purchaseFrequency}</Badge>
                            <Badge tone="slate">{item.quantity} {item.unit}</Badge>
                            {listType && <Badge tone="indigo">{listType.listName.replace(' Shopping List', '')}</Badge>}
                            {item.expiryDate && <Badge tone="rose">Exp {formatCompactDate(item.expiryDate)}</Badge>}
                          </div>
                          {item.notes && <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.notes}</p>}
                          <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <p className="text-[11px] text-slate-400">{formatCompactDate(item.startDate)}</p>
                            <button
                              className={cn(
                                'soft-pill px-3 py-1.5 text-[11px] font-bold transition',
                                item.purchased
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:text-indigo-700',
                              )}
                              disabled={!canManageGroceries}
                              onClick={() => toggleGroceryPurchased(item.id)}
                              type="button"
                            >
                              {item.purchased ? 'Purchased' : 'Mark purchased'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </CardContent>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500">
                  Page {Math.floor(page.offset / page.limit) + 1} - {filteredItems.length} loaded
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={page.offset === 0 || page.isLoading}
                    onClick={() => store.loadGroceryPage(page.offset - page.limit, selectedListId)}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!page.hasNext || page.isLoading}
                    onClick={() => store.loadGroceryPage(page.offset + page.limit, selectedListId)}
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="grid gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Add Item to Master List</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Included in the next cycle generation</p>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3.5" onSubmit={handleSubmit}>
                  <fieldset className="m-0 grid gap-3.5 border-0 p-0" disabled={!canManageGroceries}>
                    <FormField label="Item name">
                      <input
                        className={inputClass}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, itemName: event.target.value }))
                        }
                        placeholder="e.g. Paneer, Milk, Rice"
                        value={draft.itemName}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Quantity">
                        <input
                          className={inputClass}
                          min="0"
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, quantity: Number(event.target.value) }))
                          }
                          step="0.5"
                          type="number"
                          value={draft.quantity}
                        />
                      </FormField>
                      <FormField label="Unit">
                        <select
                          className={inputClass}
                          onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
                          value={draft.unit}
                        >
                          {unitOptions.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <FormField label="List type">
                      <select
                        className={inputClass}
                        onChange={(event) => setDraft((current) => ({ ...current, listTypeId: Number(event.target.value) }))}
                        value={draft.listTypeId}
                      >
                        {state.listTypes.map((listType) => (
                          <option key={listType.id} value={listType.id}>{listType.listName}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Purchase frequency">
                      <select
                        className={inputClass}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, purchaseFrequency: event.target.value as Frequency }))
                        }
                        value={draft.purchaseFrequency}
                      >
                        {frequencyOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Notes">
                      <textarea
                        className={cn(inputClass, 'min-h-20 resize-none')}
                        onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Brand preference, size, etc."
                        value={draft.notes}
                      />
                    </FormField>
                    <label className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
                      <input
                        checked={draft.currentStock}
                        className="size-4 rounded-md border-slate-300 text-indigo-600"
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, currentStock: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      Current stock available
                    </label>
                    <Button type="submit">
                      <Plus className="size-4" aria-hidden="true" />
                      Add to master list
                    </Button>
                  </fieldset>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchase Cycles</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Auto-generated per list type and frequency</p>
              </CardHeader>
              <CardContent className="grid gap-3">
                {state.groceryCycles.map((cycle) => {
                  const listType = state.listTypes.find((list) => list.id === cycle.listTypeId)
                  const cycleItems = state.groceryItems.filter(
                    (item) => item.listTypeId === cycle.listTypeId && item.purchaseFrequency === cycle.frequency,
                  )
                  const completed = cycleItems.filter((item) => item.purchased).length
                  const progress = cycleItems.length === 0 ? 0 : Math.round((completed / cycleItems.length) * 100)

                  return (
                    <div className="rounded-xl border border-slate-100/80 bg-slate-50/50 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm" key={cycle.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShoppingBasket className="size-4 text-indigo-500" aria-hidden="true" />
                          <p className="text-sm font-semibold text-slate-900">{listType?.listName}</p>
                        </div>
                        <Badge tone="teal">{cycle.frequency}</Badge>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {formatCompactDate(cycle.cycleStartDate)} - {formatCompactDate(cycle.cycleEndDate)}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {completed} of {cycleItems.length} purchased
                      </p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Shopping Places</CardTitle>
                  <p className="mt-1 text-xs text-slate-400">{state.listTypes.length} stores configured</p>
                </div>
                <Button disabled={!canManageGroceries} variant="secondary" onClick={() => setShowAddPlace(!showAddPlace)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                {state.listTypes.map((lt) => (
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-100/80 bg-slate-50/50 p-3.5 transition-all duration-200 hover:bg-white hover:shadow-sm" key={lt.id}>
                    <span className={cn('size-3 rounded-full shadow-sm', lt.colorClass)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{lt.listName}</p>
                      <p className="truncate text-[11px] text-slate-400">{lt.description}</p>
                    </div>
                  </div>
                ))}
                {canManageGroceries && showAddPlace && (
                  <form
                    className="mt-2 grid gap-3 rounded-xl border border-indigo-100/60 bg-indigo-50/30 p-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!newPlace.name.trim()) return
                      addListType(newPlace.name.trim(), newPlace.description.trim(), newPlace.color)
                      setNewPlace({ name: '', description: '', color: 'bg-slate-500' })
                      setShowAddPlace(false)
                    }}
                  >
                    <input
                      className={inputClass}
                      onChange={(e) => setNewPlace((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Store name (e.g. Cold Storage)"
                      value={newPlace.name}
                    />
                    <input
                      className={inputClass}
                      onChange={(e) => setNewPlace((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Description (optional)"
                      value={newPlace.description}
                    />
                    <select
                      className={inputClass}
                      onChange={(e) => setNewPlace((p) => ({ ...p, color: e.target.value }))}
                      value={newPlace.color}
                    >
                      <option value="bg-slate-500">Gray</option>
                      <option value="bg-rose-500">Red</option>
                      <option value="bg-orange-500">Orange</option>
                      <option value="bg-amber-500">Amber</option>
                      <option value="bg-emerald-500">Green</option>
                      <option value="bg-teal-500">Teal</option>
                      <option value="bg-sky-500">Sky</option>
                      <option value="bg-blue-500">Blue</option>
                      <option value="bg-violet-500">Violet</option>
                      <option value="bg-pink-500">Pink</option>
                    </select>
                    <Button type="submit">
                      <Plus className="size-4" aria-hidden="true" />
                      Add place
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'shopping' && (
        <div className="grid gap-5">
          {shoppingLists.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingCart className="mx-auto size-12 text-slate-200" aria-hidden="true" />
                <p className="mt-4 text-sm font-semibold text-slate-600">No active shopping lists</p>
                <p className="mt-1 text-xs text-slate-400">
                  Click "Regenerate cycles" to create shopping lists from your master list.
                </p>
              </CardContent>
            </Card>
          ) : (
            shoppingLists.map(({ cycle, listType, items, purchased }) => {
              const progress = items.length === 0 ? 0 : Math.round((purchased / items.length) * 100)
              const allDone = purchased === items.length && items.length > 0

              return (
                <Card key={cycle.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className={cn('size-3 rounded-full', listType?.colorClass)} />
                        {listType?.listName} - {cycle.frequency}
                      </CardTitle>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatCompactDate(cycle.cycleStartDate)} - {formatCompactDate(cycle.cycleEndDate)}
                        {' - '}{purchased} of {items.length} purchased
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {allDone && <Badge tone="green">Complete</Badge>}
                      <Badge tone="teal">{progress}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-2.5 rounded-full transition-all duration-500', allDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500')}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => (
                        <label
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-200',
                            item.purchased
                              ? 'border-emerald-200/60 bg-emerald-50/40'
                              : 'border-slate-100/80 bg-white hover:border-indigo-200 hover:shadow-sm',
                          )}
                          key={item.id}
                        >
                          <input
                            checked={item.purchased}
                            className="mt-0.5 size-5 rounded-md border-slate-300 text-emerald-600"
                            disabled={!canManageGroceries}
                            onChange={() => toggleGroceryPurchased(item.id)}
                            type="checkbox"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm font-semibold', item.purchased ? 'text-slate-400 line-through' : 'text-slate-900')}>
                              {item.itemName}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {item.quantity} {item.unit}
                            </p>
                            {item.notes && <p className="mt-1 text-[11px] text-slate-400">{item.notes}</p>}
                          </div>
                          {item.purchased && (
                            <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                          )}
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
