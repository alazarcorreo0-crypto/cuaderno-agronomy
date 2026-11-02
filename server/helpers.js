// Utilidades compartidas por las rutas.
export function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isValidTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

export function normalizeTime(value) {
  if (!isValidTime(value)) return null
  return value.length === 5 ? `${value}:00` : value
}

export function localDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function localTime(date = new Date()) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export function fail(res, status, error, extra = {}) {
  return res.status(status).json({ error, ...extra })
}

export function text(value, max = 200) {
  if (value === null || value === undefined) return ''
  return String(value).trim().slice(0, max)
}

export function parseOpciones(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}
