/** Use a UTC string in SSR markup so server and browser render the same timestamp. */
export function formatTimestamp(value: string): string {
  return `${new Date(value).toISOString().replace('T', ' ').slice(0, 19)} UTC`
}
