import type { Document } from 'mongodb'
import type { ExplainResponse } from '../../../../shared/types/api'
import { mongoDb } from '../../../infrastructure/mongo/client'
import type { EngineQuery, Params } from '../types'
import { parseMongoPlan } from './mongo-plan'
import { toShellText } from './shell-text'

export type CollectionName = 'users' | 'categories' | 'products' | 'orders' | 'reviews' | 'product_views' | 'warehouses'

export interface MongoSpec {
  label: string
  notes: string[]
  collection: CollectionName
  pipeline: (params: Params) => Document[]
  /** Forces a plan, e.g. `{ $natural: 1 }` to show the cost of a collection scan. */
  hint?: (params: Params) => Document | undefined
}

export function mongoEngine(spec: MongoSpec): EngineQuery {
  const options = (params: Params, timeoutMs: number) => {
    const hint = spec.hint?.(params)
    return { maxTimeMS: timeoutMs, allowDiskUse: true, ...(hint ? { hint } : {}) }
  }
  const aggregate = (params: Params, timeoutMs: number) =>
    mongoDb().collection(spec.collection).aggregate(spec.pipeline(params), options(params, timeoutMs))

  return {
    engine: 'mongo',
    label: spec.label,
    language: 'javascript',
    notes: spec.notes,
    query: (params) => {
      const hint = spec.hint?.(params)
      const suffix = hint ? `, ${toShellText({ hint })}` : ''
      return `db.${spec.collection}.aggregate(${toShellText(spec.pipeline(params))}${suffix})`
    },
    run: (params, timeoutMs) => aggregate(params, timeoutMs).toArray(),
    explain: async (params, timeoutMs): Promise<ExplainResponse> => {
      const explanation = await aggregate(params, timeoutMs).explain('executionStats')
      return { engine: 'mongo', metrics: parseMongoPlan(explanation), plan: JSON.stringify(explanation, null, 2) }
    },
  }
}
