import type { Document } from 'mongodb'
import { DEMO } from '../../../../../shared/utils/demo'
import { mongoEngine } from '../../engines/mongo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// The recursive visited path prevents the planted cycle from revisiting a user.
const SQL = `
WITH RECURSIVE referrals (user_id, level, visited) AS (
  SELECT id, 0, CAST(CONCAT('/', id, '/') AS CHAR(2000))
  FROM users WHERE id = ?
  UNION ALL
  SELECT child.id, parent.level + 1, CONCAT(parent.visited, child.id, '/')
  FROM referrals parent
  JOIN users child ON child.referred_by_id = parent.user_id
  WHERE parent.level < 8
    AND LOCATE(CONCAT('/', child.id, '/'), parent.visited) = 0
)
SELECT r.level, COUNT(DISTINCT r.user_id) AS users,
       COALESCE(SUM(items.quantity), 0) AS units
FROM referrals r
LEFT JOIN orders o ON o.user_id = r.user_id AND o.status <> 'cancelled'
LEFT JOIN order_items items ON items.order_id = o.id
WHERE r.level > 0
GROUP BY r.level
ORDER BY r.level`

// graphLookup discovers referrals outward, then a lookup totals embedded order items.
const MONGO_PIPELINE: (userId: number) => Document[] = (userId) => [
  { $match: { _id: userId } },
  // graphLookup follows the indexed referredById field outward from this one user.
  {
    $graphLookup: {
      from: 'users',
      startWith: '$_id',
      connectFromField: '_id',
      connectToField: 'referredById',
      as: 'referrals',
      depthField: 'depth',
      maxDepth: 7,
    },
  },
  { $unwind: '$referrals' },
  { $match: { 'referrals._id': { $ne: userId } } },
  { $set: { level: { $add: ['$referrals.depth', 1] } } },
  {
    $lookup: {
      from: 'orders',
      let: { referralId: '$referrals._id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$userId', '$$referralId'] }, { $ne: ['$status', 'cancelled'] }] } } },
        { $unwind: '$items' },
        { $group: { _id: null, units: { $sum: '$items.quantity' } } },
      ],
      as: 'purchases',
    },
  },
  { $set: { units: { $ifNull: [{ $first: '$purchases.units' }, 0] } } },
  { $group: { _id: '$level', users: { $sum: 1 }, units: { $sum: '$units' } } },
  { $project: { _id: 0, level: '$_id', users: 1, units: 1 } },
  { $sort: { level: 1 } },
]

// A bounded relationship traversal groups each reached user at their minimum level.
const CYPHER = `
MATCH (root:User {id: $userId})
MATCH path = (root)-[:REFERRED*1..8]->(referred:User)
WHERE referred <> root
WITH referred, min(length(path)) AS level
OPTIONAL MATCH (referred)-[purchase:PURCHASED]->()
RETURN level, count(DISTINCT referred) AS users,
       coalesce(sum(purchase.quantity), 0) AS units
ORDER BY level`

export const referralChain: Scenario = {
  id: 'referral-chain',
  lecture: 2,
  order: 14,
  title: 'Referral chain',
  question: 'At each minimum referral level, how many users are there and how many units did they buy?',
  relationalPain: 'The recursive CTE needs an explicit visited path to survive the planted referral cycle.',
  nosqlWin:
    'MongoDB graphLookup and Neo4j relationship traversal follow referrals from one root while tracking discovered users.',
  talkingPoints: [
    'The root is excluded even though the demo referral graph contains a cycle.',
    'PURCHASED relationships store purchased quantities and omit cancelled orders.',
  ],
  params: [{ name: 'userId', label: 'User id', type: 'number', default: DEMO.referralCycleUserIds[0], min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Cycle-safe recursive CTE',
      notes: [
        'The indexed referred_by_id column expands one referral frontier at a time.',
        'A path string prevents a user from reappearing on the same traversal path.',
      ],
      sql: SQL,
      values: (p) => [p.userId as number],
    }),
    mongoEngine({
      label: '$graphLookup + order lookup',
      notes: [
        'graphLookup follows the indexed referredById relation outward.',
        'The lookup sums embedded item quantities for each discovered user.',
      ],
      collection: 'users',
      pipeline: (p) => MONGO_PIPELINE(p.userId as number),
    }),
    neo4jEngine({
      label: 'REFERRED adjacency traversal',
      notes: [
        'The source id constraint anchors the traversal.',
        'Minimum path length assigns each user to one referral level.',
      ],
      cypher: CYPHER,
    }),
  ],
}
