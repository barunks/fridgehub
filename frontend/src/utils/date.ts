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

export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

export const toIsoDateTime = (date: Date, hour = 9, minute = 0) => {
  const next = new Date(date)
  next.setHours(hour, minute, 0, 0)
  return next.toISOString()
}

export const todayIso = () => toIsoDate(startOfToday())

export const dateOffsetIso = (days: number) => toIsoDate(addDays(startOfToday(), days))

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

export const daysUntil = (isoDate: string) => {
  const current = startOfToday().getTime()
  const target = new Date(`${isoDate}T00:00:00`).getTime()
  return Math.round((target - current) / 86_400_000)
}

export const isToday = (isoDateOrDateTime: string) =>
  isoDateOrDateTime.slice(0, 10) === todayIso()

export const formatDay = (isoDate: string) => dayFormatter.format(new Date(`${isoDate}T00:00:00`))

export const formatCompactDate = (isoDate: string) =>
  compactDateFormatter.format(new Date(`${isoDate}T00:00:00`))

export const formatFullDate = (date = new Date()) => fullDateFormatter.format(date)

export const formatTime = (isoDateTime: string) => timeFormatter.format(new Date(isoDateTime))

export const formatDueLabel = (isoDateTime: string) => {
  const datePart = isoDateTime.slice(0, 10)

  if (isToday(datePart)) {
    return `Today at ${formatTime(isoDateTime)}`
  }

  const diff = daysUntil(datePart)

  if (diff === 1) {
    return `Tomorrow at ${formatTime(isoDateTime)}`
  }

  if (diff < 0) {
    return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`
  }

  return `${formatCompactDate(datePart)} at ${formatTime(isoDateTime)}`
}
