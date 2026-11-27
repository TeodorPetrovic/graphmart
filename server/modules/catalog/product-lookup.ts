import type { ProductSummary } from '../../../shared/types/api'
import type { ProductDoc } from '../../../shared/types/domain'
import { collections } from '../../infrastructure/mongo/client'
import { shell, type Tracer } from '../../infrastructure/trace'

export const SUMMARY_PROJECTION = {
  name: 1,
  brand: 1,
  categoryId: 1,
  priceCents: 1,
  stock: 1,
  ratingSummary: 1,
} as const

export type SummaryFields = Pick<ProductDoc, '_id' | keyof typeof SUMMARY_PROJECTION>

export function toProductSummary(doc: SummaryFields): ProductSummary {
  return {
    id: doc._id,
    name: doc.name,
    brand: doc.brand,
    categoryId: doc.categoryId,
    priceCents: doc.priceCents,
    stock: doc.stock,
    rating: doc.ratingSummary.avg,
    ratingCount: doc.ratingSummary.count,
  }
}

/** Hydration step of the polyglot pattern: Neo4j picks ids, MongoDB supplies documents. */
export async function findProductSummaries(ids: number[], tracer?: Tracer): Promise<Map<number, ProductSummary>> {
  if (ids.length === 0) return new Map()
  const filter = { _id: { $in: ids } }
  const work = () => collections().products.find(filter, { projection: SUMMARY_PROJECTION }).toArray()
  const docs = await (tracer
    ? tracer.run('mongo', 'Hydrate products by id', shell('products', 'find', filter, SUMMARY_PROJECTION), work)
    : work())
  return new Map(docs.map((doc) => [doc._id, toProductSummary(doc)]))
}
