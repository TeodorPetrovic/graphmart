import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// The recursive frontier records bounded distances; the outer aggregate returns null if absent.
const SQL = `
WITH RECURSIVE reachable (user_id, depth) AS (
  SELECT followee_id, 1 FROM follows WHERE follower_id = ?
  UNION DISTINCT
  SELECT f.followee_id, r.depth + 1
  FROM reachable r
  JOIN follows f ON f.follower_id = r.user_id
  WHERE r.depth < ?
)
SELECT MIN(depth) AS length
FROM reachable
WHERE user_id = ?`

// SHORTEST 1 asks the planner for one minimum path, rather than listing every walk.
const CYPHER = (depth: number) => `
MATCH (source:User {id: $fromId})
MATCH (target:User {id: $toId})
OPTIONAL MATCH path = SHORTEST 1 (source)-[:FOLLOWS]->{1,${depth}}(target)
RETURN CASE WHEN path IS NULL THEN null ELSE length(path) END AS length`

export const shortestPath: Scenario = {
  id: 'shortest-path',
  lecture: 2,
  order: 13,
  title: 'Shortest follow path',
  question: 'What is the shortest directed follow distance, up to a chosen bound?',
  relationalPain: 'MySQL grows a bounded recursive frontier and computes the minimum matching depth.',
  nosqlWin: 'SHORTEST 1 lets Neo4j stop after finding the minimum path within the bound.',
  talkingPoints: [
    'Both answers keep a row even when no path exists, with a null length.',
    'The default demo pair is four follow hops apart.',
  ],
  params: [
    { name: 'fromId', label: 'From user', type: 'number', default: DEMO.userId, min: 1 },
    { name: 'toId', label: 'To user', type: 'number', default: DEMO.distantUserId, min: 1 },
    { name: 'maxDepth', label: 'Maximum depth', type: 'number', default: 5, min: 1, max: 6 },
  ],
  engines: [
    mysqlEngine({
      label: 'Recursive BFS frontier',
      notes: ['The followee-leading primary key serves each outgoing frontier expansion.'],
      sql: SQL,
      values: (p) => [p.fromId as number, p.maxDepth as number, p.toId as number],
    }),
    neo4jEngine({
      label: 'SHORTEST 1 path',
      notes: ['Unique constraints anchor both endpoints.', 'The shortest-path operator prunes longer candidate paths.'],
      cypher: (p) => CYPHER(p.maxDepth as number),
    }),
  ],
  scaling: [3, 4, 5, 6].map((maxDepth) => ({ fromId: DEMO.userId, toId: DEMO.distantUserId, maxDepth })),
}
