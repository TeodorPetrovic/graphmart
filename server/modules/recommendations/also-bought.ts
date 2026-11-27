import type { RecommendedProduct } from '../../../shared/types/api'
import { int, readCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'
import { findProductSummaries } from '../catalog/product-lookup'

const CYPHER = `
// A two-hop buyer-product pattern counts each shared buyer once per candidate.
MATCH (product:Product {id:$productId})<-[:PURCHASED]-(buyer:User)-[:PURCHASED]->(candidate:Product)
WHERE candidate <> product
RETURN candidate.id AS productId, count(DISTINCT buyer) AS score
ORDER BY score DESC, productId
LIMIT $limit
`

/** "Customers who bought this also bought": two hops in Neo4j, documents from MongoDB. */
export async function alsoBought(productId: number, limit: number, tracer?: Tracer): Promise<RecommendedProduct[]> {
  const ranked = await readCypher<{ productId: number; score: number }>(
    CYPHER,
    { productId: int(productId), limit: int(limit) },
    { tracer, operation: 'Customers also bought (2 hops)' },
  )
  const products = await findProductSummaries(
    ranked.map((row) => row.productId),
    tracer,
  )
  return ranked.flatMap((row) => {
    const product = products.get(row.productId)
    return product ? [{ product, score: row.score, reasons: [`${row.score} shared buyers`] }] : []
  })
}
