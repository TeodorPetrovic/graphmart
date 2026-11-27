import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// The CTE separates network discovery, category affinity and product ranking.
const SQL = `
WITH RECURSIVE network (user_id, depth) AS (
  SELECT followee_id, 1 FROM follows WHERE follower_id = ?
  UNION DISTINCT
  SELECT f.followee_id, n.depth + 1
  FROM network n
  JOIN follows f ON f.follower_id = n.user_id
  WHERE n.depth < ?
),
network_users AS (
  SELECT DISTINCT user_id FROM network WHERE user_id <> ?
),
my_categories AS (
  SELECT DISTINCT p.category_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE o.user_id = ? AND o.status <> 'cancelled'
),
ranked AS (
  SELECT oi.product_id AS productId, COUNT(DISTINCT o.user_id) AS score
  FROM network_users n
  JOIN orders o ON o.user_id = n.user_id AND o.status <> 'cancelled'
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  JOIN my_categories c ON c.category_id = p.category_id
  WHERE NOT EXISTS (
    SELECT 1 FROM orders mine
    JOIN order_items bought ON bought.order_id = mine.id
    WHERE mine.user_id = ? AND mine.status <> 'cancelled'
      AND bought.product_id = oi.product_id
  )
  GROUP BY oi.product_id
)
SELECT productId, score
FROM ranked
ORDER BY score DESC, productId
LIMIT 20`

// Collect my categories and purchases once, reduce the network to distinct users, then expand.
const CYPHER = (depth: number) => `
MATCH (me:User {id: $userId})-[:PURCHASED]->(owned:Product)-[:IN_CATEGORY]->(category:Category)
WITH me, collect(DISTINCT owned) AS myProducts, collect(DISTINCT category) AS myCategories
MATCH (me)-[:FOLLOWS*1..${depth}]->(buyer:User)
WHERE buyer <> me
WITH DISTINCT buyer, myProducts, myCategories
MATCH (buyer)-[:PURCHASED]->(candidate:Product)-[:IN_CATEGORY]->(category:Category)
WHERE category IN myCategories
  AND NOT candidate IN myProducts
RETURN candidate.id AS productId, count(DISTINCT buyer) AS score
ORDER BY score DESC, productId
LIMIT 20`

export const socialRecommendations: Scenario = {
  id: 'social-recommendations',
  lecture: 2,
  order: 12,
  title: 'Social recommendations',
  question: 'Which products bought by my nearby network match categories I buy from, but that I have not bought?',
  relationalPain: 'The recursive user frontier feeds several order, item and category joins plus an anti-join.',
  nosqlWin:
    'Cypher moves from the user through bounded FOLLOWS and PURCHASED adjacency, then checks category membership.',
  talkingPoints: [
    'The score is distinct network buyers, not order count.',
    'COUNT DISTINCT prevents multiple paths from inflating a buyer’s contribution.',
  ],
  params: [
    { name: 'userId', label: 'User id', type: 'number', default: DEMO.userId, min: 1 },
    { name: 'depth', label: 'Network depth', type: 'number', default: 2, min: 1, max: 3 },
  ],
  engines: [
    mysqlEngine({
      label: 'Recursive network + relational joins',
      notes: ['Order and item indexes restrict work to reached users and their purchased products.'],
      sql: SQL,
      values: (p) => [
        p.userId as number,
        p.depth as number,
        p.userId as number,
        p.userId as number,
        p.userId as number,
      ],
    }),
    neo4jEngine({
      label: 'Network traversal + category pattern',
      notes: [
        'The traversal is bounded from the requested user.',
        'My own purchases are collected once and excluded with a list check.',
      ],
      cypher: (p) => CYPHER(p.depth as number),
    }),
  ],
  scaling: [1, 2, 3].map((depth) => ({ userId: DEMO.userId, depth })),
}
