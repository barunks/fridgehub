const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
})

const compactDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

const isoDateFormatterCache = new Map<string, Intl.DateTimeFormat>()

const padDatePart = (value: number) => String(value).padStart(2, '0')

const parseIsoDateParts = (isoDateOrDateTime: string) => {
  const [year, month, day] = isoDateOrDateTime.slice(0, 10).split('-').map(Number)
  return { day, month, year }
}

const isoDateUtcTime = (isoDate: string) => {
  const { day, month, year } = parseIsoDateParts(isoDate)
  return Date.UTC(year, month - 1, day)
}

const getIsoDateFormatter = (timeZone: string) => {
  const cached = isoDateFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  })
  isoDateFormatterCache.set(timeZone, formatter)
  return formatter
}

export const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`

export const todayIso = (timeZone?: string) => {
  if (!timeZone) return toIsoDate(startOfToday())

  try {
    const parts = getIsoDateFormatter(timeZone).formatToParts(new Date())
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (year && month && day) {
      return `${year}-${month}-${day}`
    }
  } catch {
    // Fall back to the browser calendar if the configured timezone is invalid.
  }

  return toIsoDate(startOfToday())
}

export const addDaysToIsoDate = (isoDate: string, days: number) => {
  const next = new Date(isoDateUtcTime(isoDate))
  next.setUTCDate(next.getUTCDate() + days)
  return `${next.getUTCFullYear()}-${padDatePart(next.getUTCMonth() + 1)}-${padDatePart(next.getUTCDate())}`
}

export const toIsoDateTime = (date: Date, hour = 9, minute = 0) => {
  const next = new Date(date)
  next.setHours(hour, minute, 0, 0)
  return next.toISOString()
}

export const dateOffsetIso = (days: number, timeZone?: string) => addDaysToIsoDate(todayIso(timeZone), days)

export const dateTimeOffsetIso = (days: number, hour: number, minute = 0) =>
  toIsoDateTime(addDays(startOfToday(), days), hour, minute)

export const weekStart = (date = startOfToday()) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

export const weekEnd = (date = startOfToday()) => {
  const end = addDays(weekStart(date), 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export const daysBetweenIsoDates = (startIso: string, endIso: string) =>
  Math.round((isoDateUtcTime(endIso) - isoDateUtcTime(startIso)) / 86_400_000)

const addMonthsToIsoDate = (isoDate: string, months: number) => {
  const { day, month, year } = parseIsoDateParts(isoDate)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const targetYear = target.getUTCFullYear()
  const targetMonth = target.getUTCMonth()
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  return `${targetYear}-${padDatePart(targetMonth + 1)}-${padDatePart(targetDay)}`
}

const occurrenceInSteppedDaysRange = (anchorIso: string, stepDays: number, rangeStartIso: string, rangeEndIso: string) => {
  if (rangeEndIso < anchorIso) return null
  const firstCandidateOffset = Math.max(0, daysBetweenIsoDates(anchorIso, rangeStartIso))
  const remainder = firstCandidateOffset % stepDays
  const firstOccurrenceOffset = remainder === 0 ? firstCandidateOffset : firstCandidateOffset + (stepDays - remainder)
  const occurrence = addDaysToIsoDate(anchorIso, firstOccurrenceOffset)
  return occurrence <= rangeEndIso ? occurrence : null
}

const occurrenceInSteppedMonthsRange = (anchorIso: string, stepMonths: number, rangeStartIso: string, rangeEndIso: string) => {
  if (rangeEndIso < anchorIso) return null

  let monthOffset = 0
  const anchorParts = parseIsoDateParts(anchorIso)
  const rangeParts = parseIsoDateParts(rangeStartIso)
  const roughOffset = (rangeParts.year - anchorParts.year) * 12 + (rangeParts.month - anchorParts.month)
  if (roughOffset > 0) {
    monthOffset = Math.floor(roughOffset / stepMonths) * stepMonths
  }

  for (let offset = Math.max(0, monthOffset); offset <= roughOffset + stepMonths * 2 + 12; offset += stepMonths) {
    const occurrence = addMonthsToIsoDate(anchorIso, offset)
    if (occurrence > rangeEndIso) return null
    if (occurrence >= rangeStartIso) return occurrence
  }

  return null
}

export const nextRecurringOccurrenceInRange = (
  anchorIsoDateOrDateTime: string,
  recurrenceType: string,
  recurrenceInterval: number | undefined,
  rangeStartIso: string,
  rangeEndIso: string,
  recurrenceEndIsoDateOrDateTime?: string | null,
) => {
  const anchorIso = anchorIsoDateOrDateTime.slice(0, 10)
  const interval = Math.max(1, Number(recurrenceInterval) || 1)
  const boundedRangeEndIso =
    recurrenceEndIsoDateOrDateTime && recurrenceEndIsoDateOrDateTime.slice(0, 10) < rangeEndIso
      ? recurrenceEndIsoDateOrDateTime.slice(0, 10)
      : rangeEndIso

  if (rangeStartIso > boundedRangeEndIso) return null

  if (recurrenceType === 'daily') {
    return occurrenceInSteppedDaysRange(anchorIso, interval, rangeStartIso, boundedRangeEndIso)
  }
  if (recurrenceType === 'weekly') {
    return occurrenceInSteppedDaysRange(anchorIso, interval * 7, rangeStartIso, boundedRangeEndIso)
  }
  if (recurrenceType === 'monthly') {
    return occurrenceInSteppedMonthsRange(anchorIso, interval, rangeStartIso, boundedRangeEndIso)
  }
  if (recurrenceType === 'quarterly') {
    return occurrenceInSteppedMonthsRange(anchorIso, interval * 3, rangeStartIso, boundedRangeEndIso)
  }
  if (recurrenceType === 'semi_annually') {
    return occurrenceInSteppedMonthsRange(anchorIso, interval * 6, rangeStartIso, boundedRangeEndIso)
  }
  if (recurrenceType === 'yearly') {
    return occurrenceInSteppedMonthsRange(anchorIso, interval * 12, rangeStartIso, boundedRangeEndIso)
  }

  return isIsoDateInRange(anchorIso, rangeStartIso, boundedRangeEndIso) ? anchorIso : null
}

export const recurringDateIntersectsRange = (
  anchorIsoDateOrDateTime: string,
  recurrenceType: string,
  recurrenceInterval: number | undefined,
  rangeStartIso: string,
  rangeEndIso: string,
  recurrenceEndIsoDateOrDateTime?: string | null,
) =>
  Boolean(
    nextRecurringOccurrenceInRange(
      anchorIsoDateOrDateTime,
      recurrenceType,
      recurrenceInterval,
      rangeStartIso,
      rangeEndIso,
      recurrenceEndIsoDateOrDateTime,
    ),
  )

export const weekStartIso = (isoDate = todayIso()) => {
  const day = new Date(isoDateUtcTime(isoDate)).getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDaysToIsoDate(isoDate, diff)
}

export const weekEndIso = (isoDate = todayIso()) => addDaysToIsoDate(weekStartIso(isoDate), 6)

export const isIsoDateInRange = (isoDateOrDateTime: string, startIso: string, endIso: string) => {
  const isoDate = isoDateOrDateTime.slice(0, 10)
  return isoDate >= startIso && isoDate <= endIso
}

export const isoDateRangesOverlap = (startIso: string, endIso: string, rangeStartIso: string, rangeEndIso: string) =>
  startIso.slice(0, 10) <= rangeEndIso && endIso.slice(0, 10) >= rangeStartIso

export const isDateInRange = (isoDateOrDateTime: string, start: Date, end: Date) => {
  const date = new Date(`${isoDateOrDateTime.slice(0, 10)}T00:00:00`)
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

export const isWithinCurrentWeek = (isoDateOrDateTime: string) =>
  isDateInRange(isoDateOrDateTime, weekStart(), weekEnd())

export const dateRangesOverlap = (startIso: string, endIso: string, rangeStart: Date, rangeEnd: Date) => {
  const start = new Date(`${startIso.slice(0, 10)}T00:00:00`)
  const end = new Date(`${endIso.slice(0, 10)}T23:59:59`)
  return start.getTime() <= rangeEnd.getTime() && end.getTime() >= rangeStart.getTime()
}

export const daysUntil = (isoDate: string, timeZone?: string) => {
  return daysBetweenIsoDates(todayIso(timeZone), isoDate)
}

export const isToday = (isoDateOrDateTime: string, timeZone?: string) =>
  isoDateOrDateTime.slice(0, 10) === todayIso(timeZone)

export const formatDay = (isoDate: string) => dayFormatter.format(new Date(`${isoDate}T00:00:00`))

export const formatCompactDate = (isoDate: string) =>
  compactDateFormatter.format(new Date(`${isoDate}T00:00:00`))

export const formatFullDate = (date: Date | string = new Date()) =>
  fullDateFormatter.format(typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date)

export const formatTime = (isoDateTime: string) => timeFormatter.format(new Date(isoDateTime))

export const formatDueLabel = (isoDateTime: string, timeZone?: string) => {
  const datePart = isoDateTime.slice(0, 10)

  if (isToday(datePart, timeZone)) {
    return `Today at ${formatTime(isoDateTime)}`
  }

  const diff = daysUntil(datePart, timeZone)

  if (diff === 1) {
    return `Tomorrow at ${formatTime(isoDateTime)}`
  }

  if (diff < 0) {
    return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`
  }

  return `${formatCompactDate(datePart)} at ${formatTime(isoDateTime)}`
}
