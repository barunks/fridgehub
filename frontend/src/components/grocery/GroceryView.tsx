import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, RefreshCw, Search, ShoppingBasket } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, inputClass } from '@/components/ui/FormField'
import type { FamilyHubStore } from '@/hooks/useFamilyHub'
import type { Frequency, NewGroceryItemInput } from '@/types/familyHub'
import { formatCompactDate } from '@/utils/date'
import { cn } from '@/utils/style'

const frequencyOptions: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly']

const emptyItem: NewGroceryItemInput = {
  itemName: '',
  listTypeId: 1,
  quantity: 1,
  unit: 'Unit',
  purchaseFrequency: 'weekly',
  currentStock: false,
  notes: '',
}

export const GroceryView = ({ store }: { store: FamilyHubStore }) => {
  const { state, addGroceryItem, regenerateGroceryCycles, toggleCurrentStock, toggleGroceryPurchased } = store
  const [selectedListId, setSelectedListId] = useState<number | 'all'>('all')
  const [frequency, setFrequency] = useState<Frequency | 'all'>('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<NewGroceryItemInput>(emptyItem)

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
          <p className="mt-1 text-sm text-slate-500">Master list, generated purchase cycles, and stock status</p>
        </div>
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
                <p className="mt-1 text-sm text-slate-500">{filteredItems.length} item records</p>
              </div>
              <Badge tone="blue">Master list</Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Item</th>
                    <th className="px-5 py-3">List</th>
                    <th className="px-5 py-3">Qty</th>
                    <th className="px-5 py-3">Frequency</th>
                    <th className="px-5 py-3">Stock</th>
                    <th className="px-5 py-3">Start</th>
                    <th className="px-5 py-3">Cycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const listType = state.listTypes.find((list) => list.id === item.listTypeId)

                    return (
                      <tr className="bg-white align-top" key={item.id}>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-950">{item.itemName}</p>
                          <p className="text-xs text-slate-500">{item.itemNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
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
                            {item.currentStock ? 'In stock' : 'Low stock'}
                          </button>
                        </td>
                        <td className="px-5 py-4">{formatCompactDate(item.startDate)}</td>
                        <td className="px-5 py-4">
                          <label className="inline-flex items-center gap-2">
                            <input
                              checked={item.purchased}
                              className="size-4 rounded border-slate-300 text-blue-600"
                              onChange={() => toggleGroceryPurchased(item.id)}
                              type="checkbox"
                            />
                            <span>{item.purchased ? 'Purchased' : 'Open'}</span>
                          </label>
                        </td>
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
              <CardTitle>Add Item</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Creates a master record and includes it in cycle logic</p>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={handleSubmit}>
                <FormField label="Item name">
                  <input
                    className={inputClass}
                    onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
                    placeholder="Paneer"
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
                      type="number"
                      value={draft.quantity}
                    />
                  </FormField>
                  <FormField label="Unit">
                    <input
                      className={inputClass}
                      onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
                      value={draft.unit}
                    />
                  </FormField>
                </div>
                <FormField label="List">
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
                <FormField label="Frequency">
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
                  Add item
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Cycles</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Generated per list type and frequency</p>
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
                      {formatCompactDate(cycle.cycleStartDate)} - {formatCompactDate(cycle.cycleEndDate)}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {completed} of {cycleItems.length} purchased
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
