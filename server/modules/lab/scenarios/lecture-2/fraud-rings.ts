import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// Recursive branches expand one indexed shared-resource type at a time.
const SQL = `
WITH RECURSIVE linked (user_id, hops) AS (
  SELECT ? AS user_id, 0 AS hops
  UNION DISTINCT
  SELECT peer.user_id, current.hops + 1
  FROM linked current
  JOIN orders own ON own.user_id = current.user_id AND own.status <> 'cancelled'
  JOIN orders peer ON peer.device_id = own.device_id AND peer.status <> 'cancelled'
  WHERE current.hops < ? AND peer.user_id <> current.user_id
  UNION DISTINCT
  SELECT peer.user_id, current.hops + 1
  FROM linked current
  JOIN orders own ON own.user_id = current.user_id AND own.status <> 'cancelled'
  JOIN orders peer ON peer.card_fingerprint = own.card_fingerprint AND peer.status <> 'cancelled'
  WHERE current.hops < ? AND own.card_fingerprint IS NOT NULL
    AND peer.user_id <> current.user_id
  UNION DISTINCT
  SELECT peer.user_id, current.hops + 1
  FROM linked current
  JOIN orders own ON own.user_id = current.user_id AND own.status <> 'cancelled'
  JOIN orders peer ON peer.shipping_address_id = own.shipping_address_id AND peer.status <> 'cancelled'
  WHERE current.hops < ? AND peer.user_id <> current.user_id
)
SELECT user_id AS userId, MIN(hops) AS hops
FROM linked
WHERE hops > 0
  AND user_id <> ?
GROUP BY user_id
ORDER BY hops, userId`

// Each repeated segment moves from a user to a shared resource and back to another user.
// The quantified motif counts one user-to-resource-to-user hop per repetition.
const CYPHER = (hops: number) => `
MATCH (suspect:User {id: $userId})
MATCH path = (suspect)((left:User)-[:USED_DEVICE|PAID_WITH|SHIPS_TO]->(resource)<-[:USED_DEVICE|PAID_WITH|SHIPS_TO]-(right:User)){1,${hops}}
WITH last(nodes(path)) AS linked, length(path) / 2 AS hops
WHERE linked <> suspect
RETURN linked.id AS userId, min(hops) AS hops
ORDER BY hops, userId`

export const fraudRings: Scenario = {
  id: 'fraud-rings',
  lecture: 2,
  order: 15,
  title: 'Fraud rings',
  question:
    'Which users connect to this suspect through shared devices, cards or shipping addresses, and at what minimum hop?',
  relationalPain: 'Three recursive SQL branches must expand device, card and address matches from each frontier user.',
  nosqlWin: 'A quantified path pattern repeats the user-to-resource-to-user motif over stored relationships.',
  talkingPoints: [
    'Each hop means one shared resource linking two users.',
    'Cancelled orders do not project fraud-signal relationships.',
  ],
  params: [
    { name: 'userId', label: 'Suspect user', type: 'number', default: DEMO.fraudRingUserIds[0], min: 1 },
    { name: 'hops', label: 'Maximum hops', type: 'number', default: 2, min: 1, max: 3 },
  ],
  engines: [
    mysqlEngine({
      label: 'Three-branch recursive CTE',
      notes: [
        'Device, card and address branches each use their corresponding order index.',
        'UNION DISTINCT suppresses duplicate users at the same hop.',
      ],
      sql: SQL,
      values: (p) => [p.userId as number, p.hops as number, p.hops as number, p.hops as number, p.userId as number],
    }),
    neo4jEngine({
      label: 'Quantified shared-resource pattern',
      notes: [
        'The suspect id constraint anchors the repeated QPP.',
        'The repeated motif follows only resource links attached to the current user.',
      ],
      cypher: (p) => CYPHER(p.hops as number),
    }),
  ],
  scaling: [1, 2, 3].map((hops) => ({ userId: DEMO.fraudRingUserIds[0], hops })),
}
