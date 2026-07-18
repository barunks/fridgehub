import { useEffect, useRef, useState } from 'react'
import { Globe, Hash, Loader2, MapPin, Phone } from 'lucide-react'
import { COUNTRIES, ISD_TO_COUNTRY, detectCountryFromGeolocation, detectCountryFromTimezone, type Country } from '@/utils/countries'

const inputClass =
  'min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100'

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

export const LocationFields = ({ value, onChange, phoneLabel = 'Phone number' }: LocationFieldsProps) => {
  const [detecting, setDetecting] = useState(false)
  const [isdInput, setIsdInput] = useState(value.country.isd)
  const didDetect = useRef(false)

  // Auto-detect on first mount
  useEffect(() => {
    if (didDetect.current) return
    didDetect.current = true
    setDetecting(true)
    detectCountryFromGeolocation()
      .then(({ country, postalCode, address }) => {
        setIsdInput(country.isd)
        onChange({ ...value, country, postalCode, address })
      })
      .finally(() => setDetecting(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep isdInput in sync when country changes externally
  useEffect(() => {
    setIsdInput(value.country.isd)
  }, [value.country.isd])

  const handleCountryChange = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code) ?? value.country
    setIsdInput(country.isd)
    onChange({ ...value, country })
  }

  const handleIsdChange = (raw: string) => {
    const cleaned = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`
    setIsdInput(cleaned)
    const matched = ISD_TO_COUNTRY[cleaned]
    if (matched) onChange({ ...value, country: matched })
    else onChange({ ...value })
  }

  const handleIsdBlur = () => {
    // Snap back to country's ISD if no valid match was typed
    const matched = ISD_TO_COUNTRY[isdInput]
    if (!matched) setIsdInput(value.country.isd)
  }

  return (
    <>
      {/* Country dropdown */}
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        <span className="flex items-center gap-2">
          Country
          {detecting && <Loader2 className="size-3.5 animate-spin text-slate-400" aria-label="Detecting location…" />}
        </span>
        <span className="relative block">
          <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <select
            aria-label="Country"
            className={`${inputClass} appearance-none pl-10`}
            value={value.country.code}
            onChange={(e) => handleCountryChange(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </span>
      </label>

      {/* Phone: editable ISD prefix + local number */}
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        <span>{phoneLabel}</span>
        <span className="flex">
          <span className="inline-flex min-h-12 items-center gap-1 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-2">
            <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              aria-label="ISD code"
              className="w-14 bg-transparent text-sm font-semibold text-slate-700 outline-none"
              onBlur={handleIsdBlur}
              onChange={(e) => handleIsdChange(e.target.value)}
              type="text"
              value={isdInput}
            />
          </span>
          <input
            aria-label={phoneLabel}
            autoComplete="tel-national"
            className="min-h-12 flex-1 rounded-r-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            inputMode="tel"
            onChange={(e) => onChange({ ...value, localPhone: e.target.value.replace(/[^\d\s\-()]/g, '') })}
            placeholder="9123 4567"
            type="tel"
            value={value.localPhone}
          />
        </span>
        <span className="text-xs text-slate-400">
          ISD code auto-set from country — you can edit either field
        </span>
      </label>

      {/* Postal code + Address */}
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          <span>Postal code</span>
          <span className="relative block">
            <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              aria-label="Postal code"
              autoComplete="postal-code"
              className={`${inputClass} pl-10`}
              onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
              placeholder="123456"
              type="text"
              value={value.postalCode}
            />
          </span>
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          <span>Address</span>
          <span className="relative block">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              aria-label="Address"
              autoComplete="street-address"
              className={`${inputClass} pl-10`}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
              placeholder="Block 123, Street Name, #01-01"
              type="text"
              value={value.address}
            />
          </span>
        </label>
      </div>
    </>
  )
}

/** Default value using timezone detection (instant, no permission) */
export const defaultLocationValue = (): LocationValue => {
  const country = detectCountryFromTimezone()
  return { country, localPhone: '', postalCode: '', address: '' }
}
