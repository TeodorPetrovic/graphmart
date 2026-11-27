import type { OutboxPayload } from '../../../../shared/types/domain'
import { int, writeCypher } from '../../../infrastructure/neo4j/client'
import type { Tracer } from '../../../infrastructure/trace'

const cypher = `
MATCH (user:User {id: $userId})
MATCH (product:Product {id: $productId})
MERGE (user)-[view:VIEWED]->(product)
ON CREATE SET view.count = 0,
              view.eventIds = []
WITH view, datetime($at) AS viewedAt
// Outbox delivery is at least once; the event id makes each increment idempotent.
WHERE NOT $eventId IN view.eventIds
SET view.count = view.count + 1,
    view.lastAt = CASE WHEN view.lastAt IS NULL OR view.lastAt < viewedAt THEN viewedAt ELSE view.lastAt END,
    view.eventIds = view.eventIds + $eventId
`

export function projectProductView(
  payload: Extract<OutboxPayload, { type: 'product.viewed' }>,
  eventId: string,
  tracer?: Tracer,
) {
  const view = payload.view
  return writeCypher(
    cypher,
    {
      userId: int(view.userId),
      productId: int(view.productId),
      at: view.at,
      eventId,
    },
    { tracer, operation: 'Project product view' },
  )
}
