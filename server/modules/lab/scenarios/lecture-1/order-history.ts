import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import type { Scenario } from '../../types'

// The user/order index finds one customer's orders before item joins expand each order into lines.
const SQL = `
SELECT o.id AS orderId, o.created_at AS createdAt, oi.line_no AS lineNo,
       oi.product_id AS productId, oi.product_name AS name,
       oi.unit_price_cents AS unitPriceCents, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = ?
  AND o.status <> 'cancelled'
ORDER BY o.created_at DESC, o.id DESC, oi.line_no`

// Items are embedded snapshots, so one indexed user order scan returns complete lines.
const pipeline = (userId: number) => [
  { $match: { userId, status: { $ne: 'cancelled' } } },
  { $sort: { createdAt: -1, _id: -1 } },
  { $unwind: { path: '$items', includeArrayIndex: 'itemIndex' } },
  {
    $project: {
      _id: 0,
      orderId: '$_id',
      createdAt: 1,
      lineNo: { $add: ['$itemIndex', 1] },
      productId: '$items.productId',
      name: '$items.name',
      unitPriceCents: '$items.unitPriceCents',
      quantity: '$items.quantity',
    },
  },
  { $sort: { createdAt: -1, orderId: -1, lineNo: 1 } },
]

export const orderHistory: Scenario = {
  id: 'order-history',
  lecture: 1,
  order: 3,
  title: 'Read an order history',
  question: 'What line items did one customer order, newest first?',
  relationalPain: 'The read joins each indexed order to a separate item table.',
  nosqlWin: 'An order embeds its purchased item snapshots, avoiding a join for this customer history.',
  talkingPoints: [
    'The orders index supports the user filter and reverse chronological scan.',
    'Embedding preserves the purchased name and price even if the live product changes.',
    'A large order can still make embedding less attractive; the document boundary is a workload choice.',
  ],
  params: [{ name: 'userId', label: 'User id', type: 'number', default: DEMO.userId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Order index + item join',
      notes: [
        'The filter starts at ix_orders_user_created.',
        'Cancelled orders are excluded and lines have a stable line number.',
      ],
      sql: SQL,
      values: (params) => [params.userId as number],
    }),
    mongoEngine({
      label: 'Orders with embedded items',
      notes: [
        'The userId/createdAt index serves this history read.',
        'Items remain embedded in their order snapshots.',
      ],
      collection: 'orders',
      pipeline: (params) => pipeline(params.userId as number),
    }),
  ],
}
