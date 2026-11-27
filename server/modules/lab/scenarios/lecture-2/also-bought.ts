import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// The distinct buyer CTE restricts the product-index expansion before aggregation.
const SQL = `
WITH buyers AS (
  SELECT DISTINCT o.user_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = ?
    AND o.status <> 'cancelled'
),
co_bought AS (
  SELECT oi.product_id AS productId, COUNT(DISTINCT o.user_id) AS sharedBuyers
  FROM buyers b
  JOIN orders o ON o.user_id = b.user_id AND o.status <> 'cancelled'
  JOIN order_items oi ON oi.order_id = o.id
  WHERE oi.product_id <> ?
  GROUP BY oi.product_id
)
SELECT productId, sharedBuyers
FROM co_bought
ORDER BY sharedBuyers DESC, productId
LIMIT 20`

// The product anchor traverses stored purchases directly to co-buyers and candidates.
const CYPHER = `
MATCH (featured:Product {id: $productId})<-[:PURCHASED]-(buyer:User)
WITH featured, collect(DISTINCT buyer) AS buyers
UNWIND buyers AS buyer
MATCH (buyer)-[:PURCHASED]->(candidate:Product)
WHERE candidate <> featured
WITH candidate, count(DISTINCT buyer) AS sharedBuyers
RETURN candidate.id AS productId, sharedBuyers
ORDER BY sharedBuyers DESC, productId
LIMIT 20`

export const alsoBought: Scenario = {
  id: 'also-bought',
  lecture: 2,
  order: 11,
  title: 'Also bought',
  question: 'Which other products share the most distinct buyers with this product?',
  relationalPain:
    'SQL first materializes the distinct buyer set, then uses the product-leading order item index to expand purchases.',
  nosqlWin: 'Neo4j starts at the product and traverses its PURCHASED relationships to buyers and their other products.',
  talkingPoints: [
    'Distinct buyers are established before expanding to their other orders.',
    'PURCHASED excludes cancelled orders in the graph projection.',
  ],
  params: [{ name: 'productId', label: 'Product id', type: 'number', default: DEMO.productId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Distinct buyer set + indexed expansion',
      notes: ['The CTE restricts work to buyers of the requested product before expanding their purchases.'],
      sql: SQL,
      values: (p) => [p.productId as number, p.productId as number],
    }),
    neo4jEngine({
      label: 'Product-to-buyer traversal',
      notes: ['The unique product id anchors traversal.', 'Stored PURCHASED relationships omit cancelled orders.'],
      cypher: CYPHER,
    }),
  ],
}
