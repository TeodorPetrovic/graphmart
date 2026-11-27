import type { OutboxPayload } from '../../../../shared/types/domain'
import { int, writeCypher } from '../../../infrastructure/neo4j/client'
import type { Tracer } from '../../../infrastructure/trace'

const cypher = `
MERGE (product:Product {id: $id})
SET product.name = $name,
    product.priceCents = $priceCents,
    product.brand = $brand
WITH product
OPTIONAL MATCH (product)-[oldBrand:MADE_BY]->()
DELETE oldBrand
WITH product
MERGE (brand:Brand {name: $brand})
MERGE (product)-[:MADE_BY]->(brand)
WITH product
OPTIONAL MATCH (product)-[oldCategory:IN_CATEGORY]->()
DELETE oldCategory
WITH product
MATCH (category:Category {id: $categoryId})
MERGE (product)-[:IN_CATEGORY]->(category)
`

export function projectUpsertedProduct(payload: Extract<OutboxPayload, { type: 'product.upserted' }>, tracer?: Tracer) {
  const product = payload.product
  return writeCypher(
    cypher,
    {
      id: int(product.id),
      name: product.name,
      priceCents: int(product.priceCents),
      brand: product.brand,
      categoryId: int(product.categoryId),
    },
    { tracer, operation: 'Project product' },
  )
}
