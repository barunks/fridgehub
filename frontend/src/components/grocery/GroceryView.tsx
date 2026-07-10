import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, List, Plus, RefreshCw, Search, ShoppingBasket, ShoppingCart } from 'lucide-react'
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
  const { state, addGroceryItem, addListType, regenerateGroceryCycles, toggleCurrentStock, toggleGroceryPurchased } = store
  const [tab, setTab] = useState<Tab>('master')
  const [selectedListId, setSelectedListId] = useState<number | 'all'>('all')
  const [frequency, setFrequency] = useState<Frequency | 'all'>('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<NewGroceryItemInput>(emptyItem)
  const [newPlace, setNewPlace] = useState({ name: '', description: '', color: 'bg-slate-500' })
  const [showAddPlace, setShowAddPlace] = useState(false)

  const filteredItems = useMemo(() => {
    const normalized = search.toLowerCase().trim()

    return state.groceryItems.filter((item) => {
      const matchesList = selectedListId === 'all' || item.listTypeId === selectedListId
      const matchesFrequency = frequency === 'all' || item.purchaseFrequency === frequency
      const matchesSearch =
        !normalized ||
        item.itemName.toLowerCase().includes(normalized) ||
        item.notes.toLowerCase().includes(normalized) ||
        item.itemNumber.toLowerCase().includes(normalized)

      return matchesList && matchesFrequency && matchesSearch
    })
  }, [frequency, search, selectedListId, state.groceryItems])

  // Group active cycles with their items for the Shopping Lists tab
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.itemName.trim()) {
      return
    }

    addGroceryItem({
      ...draft,
      itemName: draft.itemName.trim(),
      notes: draft.notes.trim(),
      quantity: Number(draft.quantity) || 1,
    })
    setDraft(emptyItem)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Grocery Management</h2>
          <p className="mt-1 text-sm text-slate-500">Master list, purchase cycles, and shopping sub-lists</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
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
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
            tab === 'master' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-700',
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
            tab === 'shopping' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('shopping')}
          type="button"
        >
          <ShoppingCart className="size-4" aria-hidden="true" />
          Shopping Lists
          {shoppingLists.length > 0 && (
            <Badge tone="blue">{shoppingLists.length}</Badge>
          )}
        </button>
      </div>

      {tab === 'master' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
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
                      <option key={listType.id} value={listType.id}>
                        {listType.listName}
                      </option>
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
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Search">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      className={cn(inputClass, 'pl-9')}
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
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredItems.length} items — add/remove items here, sub-lists auto-generate per cycle
                  </p>
                </div>
                <Badge tone="blue">Master list</Badge>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Item</th>
                      <th className="px-5 py-3">List</th>
                      <th className="px-5 py-3">Qty</th>
                      <th className="px-5 py-3">Frequency</th>
                      <th className="px-5 py-3">Stock</th>
                      <th className="px-5 py-3">Start date</th>
                      <th className="px-5 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item) => {
                      const listType = state.listTypes.find((list) => list.id === item.listTypeId)

                      return (
                        <tr className="bg-white align-top" key={item.id}>
                          <td className="px-5 py-4 text-xs text-slate-400">{item.itemNumber}</td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950">{item.itemName}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2">
                              <span className={cn('size-2.5 rounded-full', listType?.colorClass)} />
                              {listType?.listName}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-5 py-4">
                            <Badge tone={item.purchaseFrequency === 'weekly' ? 'green' : 'amber'}>
                              {item.purchaseFrequency}
                            </Badge>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              className={cn(
                                'rounded-md border px-3 py-1.5 text-xs font-semibold transition',
                                item.currentStock
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-rose-200 bg-rose-50 text-rose-700',
                              )}
                              onClick={() => toggleCurrentStock(item.id)}
                              type="button"
                            >
                              {item.currentStock ? 'YES' : 'NO'}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-xs">{formatCompactDate(item.startDate)}</td>
                          <td className="px-5 py-4 text-xs text-slate-500">{item.notes}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <aside className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Add Item to Master List</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Item will be included in the next cycle generation</p>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleSubmit}>
                  <FormField label="Item name">
                    <input
                      className={inputClass}
                      onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
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
                        <option key={listType.id} value={listType.id}>
                          {listType.listName}
                        </option>
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
                        <option key={option} value={option}>
                          {option}
                        </option>
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
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      checked={draft.currentStock}
                      className="size-4 rounded border-slate-300 text-blue-600"
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
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchase Cycles</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Auto-generated per list type and frequency</p>
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
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={cycle.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShoppingBasket className="size-4 text-blue-600" aria-hidden="true" />
                          <p className="font-semibold text-slate-950">{listType?.listName}</p>
                        </div>
                        <Badge tone="teal">{cycle.frequency}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCompactDate(cycle.cycleStartDate)} → {formatCompactDate(cycle.cycleEndDate)}
                      </p>
                      <div className="mt-3 h-2 rounded-full bg-white">
                        <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
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
                  <p className="mt-1 text-sm text-slate-500">{state.listTypes.length} stores configured</p>
                </div>
                <Button variant="secondary" onClick={() => setShowAddPlace(!showAddPlace)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {state.listTypes.map((lt) => (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3" key={lt.id}>
                    <span className={cn('size-3 rounded-full', lt.colorClass)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{lt.listName}</p>
                      <p className="truncate text-xs text-slate-500">{lt.description}</p>
                    </div>
                  </div>
                ))}
                {showAddPlace && (
                  <form
                    className="mt-2 grid gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3"
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
        <div className="grid gap-4">
          {shoppingLists.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="mx-auto size-10 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-600">No active shopping lists</p>
                <p className="mt-1 text-sm text-slate-400">
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
                        {listType?.listName} — {cycle.frequency}
                      </CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatCompactDate(cycle.cycleStartDate)} → {formatCompactDate(cycle.cycleEndDate)}
                        {' · '}{purchased} of {items.length} purchased
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {allDone && <Badge tone="green">Complete</Badge>}
                      <Badge tone="teal">{progress}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 h-2 rounded-full bg-slate-100">
                      <div
                        className={cn('h-2 rounded-full transition-all', allDone ? 'bg-emerald-500' : 'bg-blue-500')}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => (
                        <label
                          className={cn(
                            'flex items-start gap-3 rounded-lg border p-3 transition cursor-pointer',
                            item.purchased
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-slate-100 bg-white hover:border-blue-200',
                          )}
                          key={item.id}
                        >
                          <input
                            checked={item.purchased}
                            className="mt-0.5 size-5 rounded border-slate-300 text-emerald-600"
                            onChange={() => toggleGroceryPurchased(item.id)}
                            type="checkbox"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn('font-semibold', item.purchased ? 'text-slate-400 line-through' : 'text-slate-900')}>
                              {item.itemName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.quantity} {item.unit}
                            </p>
                            {item.notes && <p className="mt-1 text-xs text-slate-400">{item.notes}</p>}
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
