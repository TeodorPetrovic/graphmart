/** Prints a value the way you would type it in mongosh: unquoted keys, short objects on one line. */
export function toShellText(value: unknown, indent = 0): string {
  if (value instanceof Date) return `ISODate("${value.toISOString()}")`
  if (value instanceof RegExp) return value.toString()
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'

  const isArray = Array.isArray(value)
  const entries = isArray
    ? value.map((item) => toShellText(item, indent + 2))
    : Object.entries(value).map(([key, item]) => `${shellKey(key)}: ${toShellText(item, indent + 2)}`)
  const [open, close] = isArray ? ['[', ']'] : ['{', '}']
  if (entries.length === 0) return `${open}${close}`

  const inline = isArray ? `[${entries.join(', ')}]` : `{ ${entries.join(', ')} }`
  if (indent + inline.length <= 90 && !inline.includes('\n')) return inline

  const padding = ' '.repeat(indent + 2)
  return `${open}\n${entries.map((entry) => `${padding}${entry}`).join(',\n')}\n${' '.repeat(indent)}${close}`
}

function shellKey(key: string): string {
  return /^[$A-Za-z_][$\w]*$/.test(key) ? key : JSON.stringify(key)
}
