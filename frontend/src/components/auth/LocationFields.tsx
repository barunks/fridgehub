import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Hash, Loader2, MapPin } from 'lucide-react'
import { COUNTRIES, detectCountryFromGeolocation, type Country } from '@/utils/countries'

const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-700/60 bg-slate-800/60 px-3.5 py-2.5 text-[16px] leading-tight text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 sm:text-sm'

export interface LocationValue {
  country: Country
  localPhone: string
  postalCode: string
  address: string
}

interface LocationFieldsProps {
  value: LocationValue
  onChange: (v: LocationValue) => void
  phoneLabel?: string
}

const dropdownListClass =
  'absolute z-50 mt-1 w-full max-w-[calc(100vw-2rem)] rounded-xl border border-white/[0.08] bg-[#13131f] shadow-2xl shadow-black/60'

const searchInputClass =
  'w-full rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[16px] text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 sm:text-sm'

/** Shared searchable country list dropdown */
const CountryDropdown = ({
  label,
  value,
  onChange,
  renderSelected,
  renderOption,
  detecting,
  triggerClass,
}: {
  label: string
  value: Country
  onChange: (c: Country) => void
  renderSelected: (c: Country) => string
  renderOption: (c: Country) => React.ReactNode
  detecting?: boolean
  triggerClass?: string
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.isd.includes(query),
      )
    : COUNTRIES

  useEffect(() => {
    if (!open) { setQuery(''); return }
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-300" ref={ref}>
      <span className="flex items-center gap-2">
        {label}
        {detecting && <Loader2 className="size-3.5 animate-spin text-violet-400" />}
      </span>
      <div className="relative">
        <button
          type="button"
          aria-label={label}
          className={triggerClass ?? `${inputClass} flex items-center justify-between gap-2 text-left`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="truncate">{renderSelected(value)}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" />
        </button>

        {open && (
          <div className={dropdownListClass}>
            <div className="border-b border-white/[0.06] p-2">
              <input
                ref={inputRef}
                className={searchInputClass}
                placeholder="Search country…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ul className="max-h-[40vh] overflow-y-auto overscroll-contain py-1" role="listbox" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-500">No results</li>
              )}
              {filtered.map((c) => (
                <li
                  key={c.code}
                  role="option"
                  aria-selected={c.code === value.code}
                  className={`cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-violet-500/10 ${
                    c.code === value.code
                      ? 'bg-violet-500/10 font-semibold text-violet-300'
                      : 'text-slate-300'
                  }`}
                  onMouseDown={() => { onChange(c); setOpen(false) }}
                >
                  {renderOption(c)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** Compact ISD dropdown for the left side of the phone field */
const IsdDropdown = ({ value, onChange }: { value: Country; onChange: (c: Country) => void }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.isd.includes(query))
    : COUNTRIES

  useEffect(() => {
    if (!open) { setQuery(''); return }
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="ISD code"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-700/60 bg-slate-800/60 px-3 text-[16px] font-semibold text-slate-300 transition-colors hover:bg-slate-700/60 sm:text-sm"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value.isd}</span>
        <ChevronDown className="size-3 shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/[0.08] bg-[#13131f] shadow-2xl shadow-black/60">
          <div className="border-b border-white/[0.06] p-2">
            <input
              ref={inputRef}
              className={searchInputClass}
              placeholder="Search country or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="max-h-[40vh] overflow-y-auto overscroll-contain py-1" role="listbox" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No results</li>}
            {filtered.map((c) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value.code}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-violet-500/10 ${
                  c.code === value.code ? 'bg-violet-500/10 font-semibold text-violet-300' : 'text-slate-300'
                }`}
                onMouseDown={() => { onChange(c); setOpen(false) }}
              >
                <span>{c.name}</span>
                <span className="ml-2 shrink-0 font-mono text-slate-500">{c.isd}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export const LocationFields = ({ value, onChange, phoneLabel = 'Phone number' }: LocationFieldsProps) => {
  const [detecting, setDetecting] = useState(false)
  const [geoFailed, setGeoFailed] = useState(false)
  const didDetect = useRef(false)
  // Keep a ref to latest onChange/value to avoid stale closure in async callback
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { valueRef.current = value }, [value])

  useEffect(() => {
    if (didDetect.current) return
    didDetect.current = true
    setDetecting(true)
    detectCountryFromGeolocation()
      .then(({ country, postalCode, address }) => {
        const detected = postalCode || address
        if (!detected) setGeoFailed(true)
        onChangeRef.current({ ...valueRef.current, country, postalCode, address })
      })
      .catch(() => setGeoFailed(true))
      .finally(() => setDetecting(false))
  }, [])

  return (
    <>
      {/* Country searchable dropdown */}
      <CountryDropdown
        label="Country"
        value={value.country}
        onChange={(country) => onChange({ ...value, country })}
        renderSelected={(c) => c.name}
        renderOption={(c) => `${c.name} (${c.isd})`}
        detecting={detecting}
      />

      {/* Phone: ISD dropdown + local number */}
      <div className="grid gap-1.5 text-sm font-medium text-slate-300">
        <span>{phoneLabel}</span>
        <div className="flex">
          <IsdDropdown value={value.country} onChange={(country) => onChange({ ...value, country })} />
          <input
            aria-label={phoneLabel}
            autoComplete="tel-national"
            className="min-h-11 flex-1 rounded-r-xl border border-l-0 border-slate-700/60 bg-slate-800/60 px-3.5 py-2.5 text-[16px] leading-tight text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
            inputMode="tel"
            onChange={(e) => onChange({ ...value, localPhone: e.target.value.replace(/[^\d\s\-()]/g, '') })}
            placeholder="e.g. 9123 4567"
            type="tel"
            value={value.localPhone}
          />
        </div>
      </div>

      {/* Postal code + Address */}
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <label className="grid gap-1.5 text-sm font-medium text-slate-300">
          <span className="flex items-center gap-2">
            Postal code
            {detecting && <Loader2 className="size-3 animate-spin text-violet-400" />}
          </span>
          <span className="relative block">
            <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              aria-label="Postal code"
              autoComplete="postal-code"
              className={`${inputClass} pl-10`}
              onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
              placeholder={detecting ? 'Detecting…' : 'e.g. 529234'}
              type="text"
              value={value.postalCode}
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-300">
          <span className="flex items-center gap-2">
            Address
            {detecting && <Loader2 className="size-3 animate-spin text-violet-400" />}
          </span>
          <span className="relative block">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              aria-label="Address"
              autoComplete="street-address"
              className={`${inputClass} pl-10`}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
              placeholder={detecting ? 'Detecting…' : 'Street, neighbourhood, city'}
              type="text"
              value={value.address}
            />
          </span>
        </label>
      </div>
      {geoFailed && !detecting && (
        <p className="-mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="size-3 shrink-0" />
          Location not detected — please enter your postal code and address manually.
        </p>
      )}
    </>
  )
}


