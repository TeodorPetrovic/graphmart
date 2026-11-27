import type { OutboxPayload } from '../../../../shared/types/domain'
import { int, writeCypher } from '../../../infrastructure/neo4j/client'
import type { Tracer } from '../../../infrastructure/trace'

const cypher = `
MERGE (user:User {id: $id})
SET user.name = $name,
    user.city = $city,
    user.tier = $tier
WITH user
OPTIONAL MATCH (referrer:User {id: $referrerId})
FOREACH (_ IN CASE WHEN referrer IS NULL THEN [] ELSE [1] END |
  MERGE (referrer)-[referral:REFERRED]->(user)
  ON CREATE SET referral.at = datetime($at)
)
`

export function projectRegisteredUser(payload: Extract<OutboxPayload, { type: 'user.registered' }>, tracer?: Tracer) {
  const user = payload.user
  return writeCypher(
    cypher,
    {
      id: int(user.id),
      name: user.name,
      city: user.city,
      tier: user.tier,
      at: user.at,
      referrerId: user.referredById === null ? int(-1) : int(user.referredById),
    },
    { tracer, operation: 'Project registered user' },
  )
}
