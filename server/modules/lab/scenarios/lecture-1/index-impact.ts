import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import type { Scenario } from '../../types'

// The selected plan changes only the index hint; the user and one-year window remain bound filters.
const sql = (useIndex: number) => `
SELECT id AS orderId, created_at AS createdAt, total_cents AS totalCents, status
FROM orders ${useIndex === 0 ? 'IGNORE INDEX (ix_orders_user_created)' : 'USE INDEX (ix_orders_user_created)'}
WHERE user_id = ?
  AND created_at >= '2025-11-01 00:00:00'
  AND status <> 'cancelled'
ORDER BY created_at DESC, id DESC`

// A natural hint demonstrates the cost of reading the collection before filtering one user.
const pipeline = (userId: number) => [
  { $match: { userId, createdAt: { $gte: new Date('2025-11-01T00:00:00.000Z') }, status: { $ne: 'cancelled' } } },
  { $sort: { createdAt: -1, _id: -1 } },
  { $project: { _id: 0, orderId: '$_id', createdAt: 1, totalCents: 1, status: 1 } },
]

export const indexImpact: Scenario = {
  id: 'index-impact',
  lecture: 1,
  order: 7,
  title: 'See the effect of the customer index',
  question: 'What were this customer’s non-cancelled orders in the last seeded year?',
  relationalPain: 'Without the user/date index, the database must examine unrelated customers’ orders.',
  nosqlWin: 'The compound user/date index narrows the read and provides its requested order.',
  talkingPoints: [
    'The result is identical in both runs; only access path changes.',
    'A forced collection scan is useful as a teaching contrast, not as a production recommendation.',
    'The date boundary matches the deterministic seed window.',
  ],
  params: [
    { name: 'useIndex', label: 'Use index (1=yes)', type: 'number', default: 1, min: 0, max: 1 },
    { name: 'userId', label: 'User id', type: 'number', default: DEMO.userId, min: 1 },
  ],
  scaling: [
    { useIndex: 0, userId: DEMO.userId },
    { useIndex: 1, userId: DEMO.userId },
  ],
  engines: [
    mysqlEngine({
      label: 'Indexed user history',
      notes: ['useIndex=1 selects ix_orders_user_created.', 'useIndex=0 forces MySQL to ignore that index.'],
      sql: (params) => sql(params.useIndex as number),
      values: (params) => [params.userId as number],
    }),
    mongoEngine({
      label: 'Compound index or natural scan',
      notes: [
        'useIndex=1 uses the userId/createdAt compound index.',
        'useIndex=0 supplies the natural-order hint for a collection scan.',
      ],
      collection: 'orders',
      pipeline: (params) => pipeline(params.userId as number),
      hint: (params) => (params.useIndex === 0 ? { $natural: 1 } : undefined),
    }),
  ],
}
