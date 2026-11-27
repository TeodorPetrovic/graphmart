const numberFormatter = new Intl.NumberFormat('en-IE')

export function formatCount(value: number): string {
  return numberFormatter.format(value)
}
