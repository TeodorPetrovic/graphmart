import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import type { Scenario } from '../../types'

// SQL groups paid orders first, then the window computes the cumulative value in month order.
const SQL = `
WITH monthly AS (
  SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
         SUM(total_cents) AS revenueCents,
         COUNT(*) AS orderCount
  FROM orders
  WHERE status <> 'cancelled'
  GROUP BY DATE_FORMAT(created_at, '%Y-%m')
)
SELECT month, revenueCents, orderCount,
       SUM(revenueCents) OVER (ORDER BY month ROWS UNBOUNDED PRECEDING) AS runningTotalCents
FROM monthly
ORDER BY month`

// MongoDB uses the createdAt index range and applies a running window after monthly grouping.
const pipeline = [
  { $match: { status: { $ne: 'cancelled' } } },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
      revenueCents: { $sum: '$totalCents' },
      orderCount: { $sum: 1 },
    },
  },
  { $set: { month: '$_id' } },
  {
    $setWindowFields: {
      sortBy: { month: 1 },
      output: { runningTotalCents: { $sum: '$revenueCents', window: { documents: ['unbounded', 'current'] } } },
    },
  },
  { $project: { _id: 0, month: 1, revenueCents: 1, orderCount: 1, runningTotalCents: 1 } },
  { $sort: { month: 1 } },
]

export const monthlyRevenue: Scenario = {
  id: 'monthly-revenue',
  lecture: 1,
  order: 5,
  title: 'Monthly revenue and running total',
  question: 'How does non-cancelled order revenue accumulate by month?',
  relationalPain: 'The relational model still needs a grouped pass before the cumulative window.',
  nosqlWin:
    'The aggregation pipeline keeps grouping and the running window together, though MySQL may be faster for this workload.',
  talkingPoints: [
    'Both engines support window calculations; data modelling does not remove aggregation work.',
    'Cancelled orders are excluded before revenue is grouped.',
    'The month key is sorted so cumulative totals are deterministic.',
  ],
  params: [],
  engines: [
    mysqlEngine({
      label: 'GROUP BY + window function',
      notes: [
        'The grouped CTE feeds a cumulative SUM window.',
        'The order date index is available, though the whole history is needed.',
      ],
      sql: SQL,
    }),
    mongoEngine({
      label: '$group + $setWindowFields',
      notes: ['One pipeline groups by calendar month.', '$setWindowFields computes the ordered cumulative revenue.'],
      collection: 'orders',
      pipeline: () => pipeline,
    }),
  ],
}
