import type { EngineId, QueryTrace } from '../../shared/types/api'

/** Collects the queries executed while handling one request. */
export class Tracer {
  readonly entries: QueryTrace[] = []

  async run<T>(engine: EngineId, operation: string, query: string, work: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      return await work()
    } finally {
      this.entries.push({ engine, operation, query, ms: round(performance.now() - start) })
    }
  }
}

export function round(ms: number): number {
  return Math.round(ms * 100) / 100
}

/** Renders a call in mongo shell syntax for display, e.g. `db.orders.find({...})`. */
export function shell(collection: string, method: string, ...args: unknown[]): string {
  const rendered = args.map((arg) => JSON.stringify(arg, null, 2)).join(', ')
  return `db.${collection}.${method}(${rendered})`
}
