import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import type { Scenario } from '../../types'

// A recursive subtree and nested aggregate derive each customer's spend before comparing to the average.
const SQL = `
WITH RECURSIVE subtree AS (
  SELECT id FROM categories WHERE id = ?
  UNION ALL
  SELECT child.id FROM categories child JOIN subtree parent ON child.parent_id = parent.id
),
customer_spend AS (
  SELECT o.user_id AS userId, SUM(oi.unit_price_cents * oi.quantity) AS spentCents
  FROM subtree s
  JOIN products p ON p.category_id = s.id
  JOIN order_items oi ON oi.product_id = p.id
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.user_id
)
SELECT spend.userId, u.name, spend.spentCents
FROM customer_spend spend
JOIN users u ON u.id = spend.userId
WHERE spend.spentCents > (SELECT AVG(spentCents) FROM customer_spend)
ORDER BY spend.spentCents DESC, spend.userId
LIMIT 20`

// Begin at one category, discover its descendants, then use the indexed embedded category id in order lookups.
const pipeline = (categoryId: number) => [
  { $match: { _id: categoryId } },
  {
    $graphLookup: {
      from: 'categories',
      startWith: '$_id',
      connectFromField: '_id',
      connectToField: 'parentId',
      as: 'descendants',
    },
  },
  { $set: { subtreeIds: { $concatArrays: [['$_id'], '$descendants._id'] } } },
  { $unwind: '$subtreeIds' },
  {
    $lookup: {
      from: 'orders',
      let: { categoryId: '$subtreeIds' },
      localField: 'subtreeIds',
      foreignField: 'items.categoryId',
      pipeline: [
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $match: { $expr: { $eq: ['$items.categoryId', '$$categoryId'] } } },
        {
          $group: { _id: '$userId', spentCents: { $sum: { $multiply: ['$items.unitPriceCents', '$items.quantity'] } } },
        },
      ],
      as: 'categorySpenders',
    },
  },
  { $unwind: '$categorySpenders' },
  { $group: { _id: '$categorySpenders._id', spentCents: { $sum: '$categorySpenders.spentCents' } } },
  { $setWindowFields: { output: { averageSpend: { $avg: '$spentCents' } } } },
  { $match: { $expr: { $gt: ['$spentCents', '$averageSpend'] } } },
  { $sort: { spentCents: -1, _id: 1 } },
  { $limit: 20 },
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'customer' } },
  { $unwind: '$customer' },
  { $project: { _id: 0, userId: '$_id', name: '$customer.name', spentCents: 1 } },
]

export const topSpenders: Scenario = {
  id: 'top-spenders',
  lecture: 1,
  order: 6,
  title: 'Find customers above the category average',
  question: 'Which customers spent above the average within this category subtree?',
  relationalPain:
    'The nested query recomputes an aggregate over a recursively selected subtree before returning the top customers.',
  nosqlWin:
    'Embedded category ids and a window average keep the comparison in one pipeline, with category matches supported by an index.',
  talkingPoints: [
    'Only customers with spend in the selected subtree contribute to the average.',
    'The order item snapshot keeps category and price together at purchase time.',
    'The relational plan remains a strong set based implementation and may compete well.',
  ],
  params: [{ name: 'categoryId', label: 'Category id', type: 'number', default: DEMO.rootCategoryId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Recursive CTE + nested averages',
      notes: [
        'The subtree CTE limits products before order aggregation.',
        'The average is computed from the same customer spend relation.',
      ],
      sql: SQL,
      values: (params) => [params.categoryId as number],
    }),
    mongoEngine({
      label: 'Category lookup + average window',
      notes: [
        'The category anchor discovers descendants.',
        'The indexed items.categoryId field narrows matching order lines.',
      ],
      collection: 'categories',
      pipeline: (params) => pipeline(params.categoryId as number),
    }),
  ],
}
