import type { OutboxPayload } from '../../../../shared/types/domain'
import { int, writeCypher } from '../../../infrastructure/neo4j/client'
import type { Tracer } from '../../../infrastructure/trace'

const cypher = `
MATCH (user:User {id: $userId})
UNWIND $items AS item
MATCH (product:Product {id: item.productId})
MERGE (user)-[purchase:PURCHASED {orderId: $orderId}]->(product)
SET purchase.quantity = item.quantity,
    purchase.at = datetime($at)
WITH DISTINCT user
MERGE (device:Device {id: $deviceId})
MERGE (user)-[:USED_DEVICE]->(device)
WITH user
FOREACH (_ IN CASE WHEN $cardFingerprint IS NULL THEN [] ELSE [1] END |
  MERGE (card:Card {fingerprint: $cardFingerprint})
  MERGE (user)-[:PAID_WITH]->(card)
)
WITH user
MERGE (address:Address {key: $addressKey})
MERGE (user)-[:SHIPS_TO]->(address)
`

export function projectPlacedOrder(payload: Extract<OutboxPayload, { type: 'order.placed' }>, tracer?: Tracer) {
  const order = payload.order
  return writeCypher(
    cypher,
    {
      userId: int(order.userId),
      items: order.items.map((item) => ({ productId: int(item.productId), quantity: int(item.quantity) })),
      orderId: int(order.id),
      at: order.at,
      deviceId: order.deviceId,
      cardFingerprint: order.cardFingerprint,
      addressKey: order.addressKey,
    },
    { tracer, operation: 'Project placed order' },
  )
}
