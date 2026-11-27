import type { ProductNetworkResponse } from '../../../shared/types/api'
import { int, readCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'
import { buildGraph, type GraphEdgeInput, type GraphNodeInput } from '../graph/dto'

interface BuyerRow {
  meName: string
  id: number
  name: string
  city: string
  distance: number
  via: { id: number; name: string }[]
  rating: number | null
}

interface CountRow {
  total: number
}

const BUYERS_QUERY = `
// SHORTEST finds each buyer's nearest follow path, then the purchase supplies social proof.
MATCH (me:User {id:$userId}), (buyer:User)
WHERE buyer <> me
MATCH path=SHORTEST 1 (me)-[:FOLLOWS]->{1,2}(buyer)
MATCH (buyer)-[:PURCHASED]->(:Product {id:$productId})
WITH me, buyer, path, length(path) AS distance
OPTIONAL MATCH (buyer)-[rating:RATED]->(:Product {id:$productId})
RETURN me.name AS meName, buyer.id AS id, buyer.name AS name, buyer.city AS city, distance,
       [person IN nodes(path)[1..-1] | {id:person.id,name:person.name}] AS via,
       rating.rating AS rating
ORDER BY distance, buyer.id
LIMIT 8
`

const COUNT_QUERY = `
// Count all nearby buyers separately so the response total never reflects the display cap.
MATCH (me:User {id:$userId}), (buyer:User)
WHERE buyer <> me
MATCH SHORTEST 1 (me)-[:FOLLOWS]->{1,2}(buyer)
MATCH (buyer)-[:PURCHASED]->(:Product {id:$productId})
RETURN count(DISTINCT buyer) AS total
`

export async function productNetwork(
  productId: number,
  userId: number,
  tracer: Tracer,
): Promise<ProductNetworkResponse> {
  const params = { userId: int(userId), productId: int(productId) }
  const [buyers, counts] = await Promise.all([
    readCypher<BuyerRow>(BUYERS_QUERY, params, { tracer, operation: 'People in your network who bought this' }),
    readCypher<CountRow>(COUNT_QUERY, params, { tracer, operation: 'Count nearby product buyers' }),
  ])
  const nodes: GraphNodeInput[] = []
  const edges: GraphEdgeInput[] = []
  for (const buyer of buyers) {
    nodes.push({ kind: 'User', key: userId, label: buyer.meName, highlight: true })
    let previousId = userId
    for (const person of buyer.via) {
      nodes.push({ kind: 'User', key: person.id, label: person.name })
      edges.push({
        type: 'FOLLOWS',
        sourceKind: 'User',
        sourceKey: previousId,
        targetKind: 'User',
        targetKey: person.id,
      })
      previousId = person.id
    }
    nodes.push({ kind: 'User', key: buyer.id, label: buyer.name })
    edges.push({ type: 'FOLLOWS', sourceKind: 'User', sourceKey: previousId, targetKind: 'User', targetKey: buyer.id })
    nodes.push({ kind: 'Product', key: productId, label: 'This product', highlight: true })
    edges.push({
      type: 'PURCHASED',
      sourceKind: 'User',
      sourceKey: buyer.id,
      targetKind: 'Product',
      targetKey: productId,
    })
    if (buyer.rating !== null)
      edges.push({
        type: 'RATED',
        sourceKind: 'User',
        sourceKey: buyer.id,
        targetKind: 'Product',
        targetKey: productId,
        props: { rating: buyer.rating },
      })
  }
  return {
    buyers: buyers.map(({ id, name, city, distance, via, rating }) => ({
      user: { id, name, city },
      distance,
      via: via.map((person) => person.name),
      rating,
    })),
    totalInNetwork: counts[0]?.total ?? 0,
    graph: buildGraph(nodes, edges),
    trace: tracer.entries,
  }
}
