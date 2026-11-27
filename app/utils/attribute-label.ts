const LABELS: Record<string, string> = {
  ram_gb: 'Memory (GB)',
  storage_gb: 'Storage (GB)',
  color: 'Colour',
  wifi6: 'Wi-Fi 6',
  capacity_gb: 'Capacity (GB)',
  warranty_years: 'Warranty (years)',
  screen_inches: 'Screen (inches)',
}

/** Turns a stored attribute key such as `battery_hours` into a label a shopper can read. */
export function attributeLabel(key: string): string {
  const known = LABELS[key]
  if (known) return known
  const words = key.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function attributeValue(value: string | number | boolean): string {
  const text = String(value)
  if (text === 'true') return 'Yes'
  if (text === 'false') return 'No'
  return text
}
