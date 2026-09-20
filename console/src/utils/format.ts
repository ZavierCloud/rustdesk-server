export function formatTime(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (typeof value === 'number') {
    if (!value) {
      return '-'
    }
    return fromEpoch(value)
  }
  const trimmed = value.trim()
  const asNumber = Number(trimmed)
  if (trimmed !== '' && !Number.isNaN(asNumber) && /^\d+$/.test(trimmed)) {
    return fromEpoch(asNumber)
  }
  return trimmed
}

function fromEpoch(value: number): string {
  const ms = value < 1e12 ? value * 1000 : value
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString()
}
