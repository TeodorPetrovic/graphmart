import type { ExplainResponse, Row } from '../../../../../shared/types/api'
import { DEMO } from '../../../../../shared/utils/demo'
import { findProductSummaries } from '../../../catalog/product-lookup'
import { config } from '../../../../infrastructure/config'
import { int, neo4jDriver } from '../../../../infrastructure/neo4j/client'
import { mysqlEngine } from '../../engines/mysql'
import type { EngineQuery, Params, Scenario } from '../../types'
import { profileCypher } from '../../engines/neo4j'

// The single relational statement joins the followed users through orders to product details.
const SQL = `
SELECT candidate.id AS productId, candidate.name, brand.name AS brand,
       candidate.price_cents AS priceCents, COUNT(DISTINCT buyer.id) AS score
FROM follows f
JOIN users buyer ON buyer.id = f.followee_id
JOIN orders o ON o.user_id = buyer.id AND o.status <> 'cancelled'
JOIN order_items item ON item.order_id = o.id
JOIN products candidate ON candidate.id = item.product_id
JOIN brands brand ON brand.id = candidate.brand_id
WHERE f.follower_id = ?
  AND NOT EXISTS (
    SELECT 1 FROM orders mine
    JOIN order_items purchased ON purchased.order_id = mine.id
    WHERE mine.user_id = ? AND mine.status <> 'cancelled'
      AND purchased.product_id = candidate.id
  )
GROUP BY candidate.id, candidate.name, brand.name, candidate.price_cents
ORDER BY score DESC, productId
LIMIT 20`

// Neo4j ranks ids and buyer counts; MongoDB hydrates the document-owned product fields.
const CYPHER = `
MATCH (me:User {id: $userId})-[:FOLLOWS]->(buyer:User)-[:PURCHASED]->(product:Product)
WHERE NOT EXISTS { MATCH (me)-[:PURCHASED]->(product) }
WITH product, count(DISTINCT buyer) AS score
RETURN product.id AS productId, score
ORDER BY score DESC, productId
LIMIT 20`

async function runPolyglot(params: Params, timeoutMs: number): Promise<Row[]> {
  const result = await neo4jDriver().executeQuery(
    CYPHER,
    { userId: int(params.userId as number) },
    {
      database: config.NEO4J_DATABASE,
      transactionConfig: { timeout: timeoutMs },
    },
  )
  const ids = result.records.map((record) => Number(record.get('productId')))
  const summaries = await findProductSummaries(ids)
  const scoreById = new Map(
    result.records.map((record) => [Number(record.get('productId')), Number(record.get('score'))]),
  )
  const rows = ids.flatMap((id) => {
    const product = summaries.get(id)
    return product
      ? [
          {
            productId: id,
            name: product.name,
            brand: product.brand,
            priceCents: product.priceCents,
            score: scoreById.get(id)!,
          },
        ]
      : []
  })
  return rows
}

async function explainPolyglot(params: Params, timeoutMs: number): Promise<ExplainResponse> {
  return profileCypher(CYPHER, { userId: int(params.userId as number) }, timeoutMs)
}

const polyglotEngine: EngineQuery = {
  engine: 'neo4j',
  label: 'Neo4j ranking + MongoDB hydration',
  language: 'cypher',
  notes: [
    'Neo4j ranks product ids from follow and purchase adjacency.',
    'MongoDB hydrates those ids with findProductSummaries using the product _id index.',
  ],
  query: () =>
    `// Step 1: rank ids in Neo4j\n${CYPHER}\n\n// Step 2: hydrate summaries in MongoDB\ndb.products.find({ _id: { $in: rankedProductIds } }, { name: 1, brand: 1, priceCents: 1 })`,
  run: runPolyglot,
  explain: explainPolyglot,
}

export const polyglotRecommendation: Scenario = {
  id: 'polyglot-recommendation',
  lecture: 2,
  order: 17,
  title: 'Polyglot recommendation',
  question: 'What are the top products bought by people I follow, excluding products I already bought?',
  relationalPain: 'The legacy query joins follows, orders, items, products and brands before ranking the candidates.',
  nosqlWin: 'Neo4j ranks ids from relationships, then MongoDB returns product details from its document collection.',
  talkingPoints: [
    'The graph handles relationship-heavy candidate ranking.',
    'MongoDB remains the owner of product descriptions and presentation fields.',
  ],
  params: [{ name: 'userId', label: 'User id', type: 'number', default: DEMO.userId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Relational joins + hydration in one query',
      notes: ['The order and item indexes support the followed buyers and their purchases.'],
      sql: SQL,
      values: (p) => [p.userId as number, p.userId as number],
    }),
    polyglotEngine,
  ],
}
