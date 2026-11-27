import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// UNION DISTINCT keeps one row per user and depth while the indexed frontier expands.
const SQL = `
WITH RECURSIVE reachable (user_id, depth) AS (
  SELECT followee_id, 1
  FROM follows
  WHERE follower_id = ?
  UNION DISTINCT
  SELECT f.followee_id, r.depth + 1
  FROM reachable r
  JOIN follows f ON f.follower_id = r.user_id
  WHERE r.depth < ?
)
SELECT depth, COUNT(*) AS users
FROM reachable
WHERE depth = (
  SELECT MIN(inner_reachable.depth)
  FROM reachable inner_reachable
  WHERE inner_reachable.user_id = reachable.user_id
)
GROUP BY depth
ORDER BY depth`

// Variable-length adjacency stays anchored at the indexed source node.
const CYPHER = (depth: number) => `
MATCH (source:User {id: $userId})
MATCH path = (source)-[:FOLLOWS*1..${depth}]->(friend:User)
WITH friend, min(length(path)) AS depth
RETURN depth, count(friend) AS users
ORDER BY depth`

export const friendsNetwork: Scenario = {
  id: 'friends-network',
  lecture: 2,
  order: 9,
  title: 'Friends network',
  question: 'How many users are first reached at each minimum follow depth?',
  relationalPain: 'A recursive CTE repeatedly joins the follow index and carries depth through each frontier.',
  nosqlWin: 'Neo4j follows stored adjacency from one indexed user and returns the same minimum-depth counts.',
  talkingPoints: [
    'UNION DISTINCT prevents repeating an identical user and depth.',
    'Variable-length FOLLOWS expresses the bounded traversal directly.',
  ],
  params: [
    { name: 'userId', label: 'User id', type: 'number', default: DEMO.userId, min: 1 },
    { name: 'depth', label: 'Maximum depth', type: 'number', default: 3, min: 1, max: 5 },
  ],
  engines: [
    mysqlEngine({
      label: 'Recursive CTE frontier',
      notes: ['The primary key on (follower_id, followee_id) supports each frontier expansion.'],
      sql: SQL,
      values: (p) => [p.userId as number, p.depth as number],
    }),
    neo4jEngine({
      label: 'Bounded adjacency traversal',
      notes: [
        'The source User lookup uses its unique id constraint.',
        'The planner expands only outgoing FOLLOWS relationships.',
      ],
      cypher: (p) => CYPHER(p.depth as number),
    }),
  ],
  scaling: [1, 2, 3, 4, 5].map((depth) => ({ userId: DEMO.userId, depth })),
}
