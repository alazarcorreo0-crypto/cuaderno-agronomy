const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const LONG_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const SHORT_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function todayLocal(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function timeNow(date = new Date()): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatFecha(value: string | null | undefined): string {
  if (!value) return '—'
  return DATE_FORMATTER.format(parseLocalDate(value))
}

export function formatFechaLarga(value: string): string {
  const text = LONG_FORMATTER.format(parseLocalDate(value))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatFechaCorta(value: string): string {
  return SHORT_FORMATTER.format(parseLocalDate(value))
}

export function formatHora(value: string | null | undefined): string {
  if (!value) return '—'
  return value.slice(0, 5)
}

export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${DATE_FORMATTER.format(date)} ${date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function isToday(value: string): boolean {
  return value === todayLocal()
}

export function relativeDay(value: string): string {
  if (isToday(value)) return 'Hoy'
  const today = parseLocalDate(todayLocal()).getTime()
  const date = parseLocalDate(value).getTime()
  const diff = Math.round((today - date) / 86400000)
  if (diff === 1) return 'Ayer'
  if (diff === -1) return 'Mañana'
  return formatFechaCorta(value)
}
