import type { Row } from '../../../shared/types/api'

type Cell = Row[string]

/** Brings driver specific values (Date, DECIMAL, Neo4j temporal types) to one comparable form. */
function normaliseValue(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return Math.round(value * 10_000) / 10_000
  if (typeof value === 'bigint') return Number(value)
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if ('toStandardDate' in value && typeof value.toStandardDate === 'function') {
    return (value.toStandardDate() as Date).toISOString()
  }
  if (Array.isArray(value)) return value.map(normaliseValue)
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normaliseValue((value as Record<string, unknown>)[key])]),
  )
}

/** Flat row with sorted column names; nested values are shown as JSON. */
export function normaliseRow(row: Record<string, unknown>): Row {
  return Object.fromEntries(
    Object.keys(row)
      .sort()
      .map((key) => {
        const value = normaliseValue(row[key])
        return [key, (value !== null && typeof value === 'object' ? JSON.stringify(value) : value) as Cell]
      }),
  )
}

/** True when every engine returned exactly the same rows in the same order. */
export function rowsMatch(results: Row[][]): boolean {
  const [first, ...others] = results.map((rows) => JSON.stringify(rows))
  return others.every((other) => other === first)
}
