import { collections } from '../../infrastructure/mongo/client'
import { readCypher, int } from '../../infrastructure/neo4j/client'
import { shell, type Tracer } from '../../infrastructure/trace'
import type { UserDoc } from '../../../shared/types/domain'

interface SocialCountsRow {
  followers: number
  following: number
}

export async function searchUsers(q: string, limit: number, tracer: Tracer) {
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = escapedQuery
    ? {
        $or: [{ name: { $regex: escapedQuery, $options: 'i' } }, { email: { $regex: escapedQuery, $options: 'i' } }],
      }
    : {}
  const rows = await tracer.run('mongo', 'Search users', `${shell('users', 'find', filter)}.limit(${limit})`, () =>
    collections().users.find(filter).limit(limit).toArray(),
  )
  return rows.map(({ _id, name, email, city, tier }) => ({ id: _id, name, email, city, tier }))
}

export async function getUser(id: number, tracer: Tracer): Promise<UserDoc | null> {
  return tracer.run('mongo', 'Load user', shell('users', 'findOne', { _id: id }), () =>
    collections().users.findOne({ _id: id }),
  )
}

export async function userSocialCounts(id: number, tracer: Tracer) {
  // The WITH clause prevents follower and following matches from multiplying each other.
  const cypher = `
MATCH (user:User {id: $id})
OPTIONAL MATCH (user)<-[incoming:FOLLOWS]-()
WITH user, count(incoming) AS followers
OPTIONAL MATCH (user)-[outgoing:FOLLOWS]->()
RETURN followers, count(outgoing) AS following
`
  try {
    const [row] = await readCypher<SocialCountsRow>(
      cypher,
      { id: int(id) },
      { tracer, operation: 'Count social connections', timeoutMs: 1200 },
    )
    return { followers: row?.followers ?? 0, following: row?.following ?? 0 }
  } catch {
    return { followers: 0, following: 0 }
  }
}

export async function userOrders(id: number, limit: number, tracer: Tracer) {
  return tracer.run(
    'mongo',
    'List user orders',
    `${shell('orders', 'find', { userId: id })}.sort({createdAt:-1}).limit(${limit})`,
    () => collections().orders.find({ userId: id }).sort({ createdAt: -1 }).limit(limit).toArray(),
  )
}
