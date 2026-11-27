/**
 * The legacy application's nested SQL next to the query that replaced it. Every pair uses the
 * demo ids and returns the same ids, which `bun run examples` checks against the live
 * databases. Shown on `/model` and printed in `docs/SQL-BEFORE-AFTER.md`.
 */
export interface BeforeAfter {
  id: string
  title: string
  question: string
  /** The "old" query: correct, but built from inner queries and self joins. */
  sql: string
  cypher: string
  changes: string
  /** Performance lab scenario that measures the same kind of question. */
  scenarioId: string
}

export const BEFORE_AFTER: BeforeAfter[] = [
  {
    id: 'network-1-to-3',
    title: 'My network at 1 to 3 steps',
    question: 'Who can user 1 reach by following at most three accounts?',
    sql: `
SELECT DISTINCT reached.id
FROM (
    -- 1 hop
    SELECT followee_id AS id
      FROM follows
     WHERE follower_id = 1
    UNION
    -- 2 hops: one inner query
    SELECT followee_id
      FROM follows
     WHERE follower_id IN (SELECT followee_id FROM follows WHERE follower_id = 1)
    UNION
    -- 3 hops: an inner query inside an inner query
    SELECT followee_id
      FROM follows
     WHERE follower_id IN (
           SELECT followee_id
             FROM follows
            WHERE follower_id IN (SELECT followee_id FROM follows WHERE follower_id = 1))
) AS reached
WHERE reached.id <> 1
ORDER BY reached.id`,
    cypher: `
MATCH (me:User {id: 1})-[:FOLLOWS*1..3]->(person:User)
WHERE person <> me
RETURN DISTINCT person.id AS id
ORDER BY id`,
    changes: 'Each extra hop adds another level of nesting in SQL. In Cypher, change the upper bound in *1..3.',
    scenarioId: 'friends-network',
  },
  {
    id: 'people-you-may-know',
    title: 'People you may know',
    question: 'Who is followed by at least two people I follow, excluding people I already follow?',
    sql: `
SELECT candidate.id
FROM (
    SELECT second.followee_id AS id, COUNT(*) AS mutual
      FROM follows AS second
     WHERE second.follower_id IN (SELECT followee_id FROM follows WHERE follower_id = 1)
     GROUP BY second.followee_id
) AS candidate
WHERE candidate.mutual >= 2
  AND candidate.id <> 1
  AND candidate.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = 1)
ORDER BY candidate.id`,
    cypher: `
MATCH (me:User {id: 1})-[:FOLLOWS]->(mutual:User)-[:FOLLOWS]->(candidate:User)
WHERE candidate <> me
WITH me, candidate, count(mutual) AS mutualCount
WHERE mutualCount >= 2
  AND NOT EXISTS { (me)-[:FOLLOWS]->(candidate) }
RETURN candidate.id AS id
ORDER BY id`,
    changes:
      'SQL repeats the inner query that finds people I follow. The graph pattern states the path once. MySQL is fast here: two hops over a good index is cheap.',
    scenarioId: 'people-you-may-know',
  },
  {
    id: 'also-bought',
    title: 'Customers who bought this also bought',
    question: 'Which products were bought by people who bought product 1?',
    sql: `
SELECT DISTINCT items.product_id AS id
FROM order_items AS items
WHERE items.order_id IN (
      SELECT o.id
        FROM orders AS o
       WHERE o.status <> 'cancelled'
         AND o.user_id IN (
             SELECT buyer.user_id
               FROM orders AS buyer
              WHERE buyer.status <> 'cancelled'
                AND buyer.id IN (SELECT order_id FROM order_items WHERE product_id = 1)))
  AND items.product_id <> 1
ORDER BY id`,
    cypher: `
MATCH (:Product {id: 1})<-[:PURCHASED]-(buyer:User)-[:PURCHASED]->(other:Product)
WHERE other.id <> 1
RETURN DISTINCT other.id AS id
ORDER BY id`,
    changes: 'Three nested inner queries across two tables become one path: product, buyer, product.',
    scenarioId: 'also-bought',
  },
  {
    id: 'shared-identity',
    title: 'Fraud: accounts that share a card, device, or address',
    question: 'Which accounts are directly linked to user 101?',
    sql: `
SELECT u.id
FROM users AS u
WHERE u.id <> 101
  AND (
      -- same device
      EXISTS (SELECT 1 FROM orders AS theirs
               WHERE theirs.user_id = u.id AND theirs.status <> 'cancelled'
                 AND theirs.device_id IN (SELECT device_id FROM orders
                                           WHERE user_id = 101 AND status <> 'cancelled'))
      -- same payment card
      OR EXISTS (SELECT 1 FROM orders AS theirs
                  WHERE theirs.user_id = u.id AND theirs.status <> 'cancelled'
                    AND theirs.card_fingerprint IN (SELECT card_fingerprint FROM orders
                                                     WHERE user_id = 101 AND status <> 'cancelled'))
      -- same shipping address
      OR EXISTS (SELECT 1 FROM orders AS theirs
                   JOIN addresses AS a ON a.id = theirs.shipping_address_id
                  WHERE theirs.user_id = u.id AND theirs.status <> 'cancelled'
                    AND (a.street, a.city, a.zip) IN (
                        SELECT mine.street, mine.city, mine.zip
                          FROM orders AS o
                          JOIN addresses AS mine ON mine.id = o.shipping_address_id
                         WHERE o.user_id = 101 AND o.status <> 'cancelled'))
  )
ORDER BY u.id`,
    cypher: `
MATCH (:User {id: 101})-[:USED_DEVICE|PAID_WITH|SHIPS_TO]->(shared)
      <-[:USED_DEVICE|PAID_WITH|SHIPS_TO]-(linked:User)
RETURN DISTINCT linked.id AS id
ORDER BY id`,
    changes:
      'Device, card, and address are columns in SQL, so each needs its own correlated block. In the graph they form one pattern, with longer chains expressed as longer patterns.',
    scenarioId: 'fraud-rings',
  },
  {
    id: 'category-subtree',
    title: 'All products under a category',
    question: 'Which products belong to Electronics or any of its sub-categories?',
    sql: `
SELECT p.id
FROM products AS p
WHERE p.category_id IN (
      WITH RECURSIVE tree AS (
          SELECT id FROM categories WHERE id = 1
          UNION ALL
          SELECT child.id FROM categories AS child
            JOIN tree ON child.parent_id = tree.id
      )
      SELECT id FROM tree)
ORDER BY p.id`,
    cypher: `
MATCH (product:Product)-[:IN_CATEGORY]->(:Category)-[:SUBCATEGORY_OF*0..]->(:Category {id: 1})
RETURN product.id AS id
ORDER BY id`,
    changes:
      'SQL needs a recursive query inside an inner query. Cypher uses *0.., and MongoDB avoids recursion entirely with the stored categoryPath array.',
    scenarioId: 'category-tree',
  },
]
