import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// The anti-join excludes existing follows after candidate generation from mutuals.
const SQL = `
SELECT candidate.followee_id AS userId, COUNT(*) AS mutualCount
FROM follows mine
JOIN follows candidate ON candidate.follower_id = mine.followee_id
WHERE mine.follower_id = ?
  AND candidate.followee_id <> ?
  AND NOT EXISTS (
    SELECT 1 FROM follows already_followed
    WHERE already_followed.follower_id = ?
      AND already_followed.followee_id = candidate.followee_id
  )
GROUP BY candidate.followee_id
HAVING COUNT(*) >= 2
ORDER BY mutualCount DESC, userId
LIMIT 20`

// Aggregate the two-hop paths once, then run the anti-match only for candidates that qualify.
const CYPHER = `
MATCH (me:User {id: $userId})-[:FOLLOWS]->(mutual:User)-[:FOLLOWS]->(candidate:User)
WHERE candidate <> me
WITH me, candidate, count(mutual) AS mutualCount
WHERE mutualCount >= 2
  AND NOT EXISTS { (me)-[:FOLLOWS]->(candidate) }
RETURN candidate.id AS userId, mutualCount
ORDER BY mutualCount DESC, userId
LIMIT 20`

export const peopleYouMayKnow: Scenario = {
  id: 'people-you-may-know',
  lecture: 2,
  order: 10,
  title: 'People you may know',
  question: 'Who is followed by at least two people I follow, excluding myself and people I already follow?',
  relationalPain: 'The join finds second-degree candidates, then a correlated anti-join removes existing follows.',
  nosqlWin: 'The graph pattern walks two stored relationships and uses EXISTS for the anti-join.',
  talkingPoints: [
    'FOLLOWS is unique per pair, so counting paths equals counting mutual connections.',
    'The relationship pattern makes the two-hop question visible in the query.',
  ],
  params: [{ name: 'userId', label: 'User id', type: 'number', default: DEMO.userId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Two joins + anti-join',
      notes: ['The follows primary and reverse indexes support the two directions.'],
      sql: SQL,
      values: (p) => [p.userId as number, p.userId as number, p.userId as number],
    }),
    neo4jEngine({
      label: 'Two-hop graph pattern',
      notes: ['FOLLOWS expansion starts at the unique User id.', 'EXISTS checks a single direct relationship.'],
      cypher: CYPHER,
    }),
  ],
}
