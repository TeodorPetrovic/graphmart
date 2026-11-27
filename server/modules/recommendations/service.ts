import { GRAPH_TIMEOUT_MS } from '../graph/limits'
import type { RecommendedProduct, RecommendationStrategy, RecommendationsResponse } from '../../../shared/types/api'
import { int, readCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'
import { findProductSummaries } from '../catalog/product-lookup'
import { buildGraph, type GraphEdgeInput, type GraphNodeInput } from '../graph/dto'
import { recommendationReason } from '../checkout/logic'

interface RecommendationRow {
  productId: number
  score: number
  names: string[]
  evidenceTotal: number
  peers: GraphNodeInput[]
  products: GraphNodeInput[]
  evidence: GraphNodeInput[]
}

const COLLABORATIVE_QUERY = `
// Peers are users who bought something I bought.
MATCH (me:User {id:$userId})-[:PURCHASED]->(owned:Product)
WITH me, collect(DISTINCT owned) AS mine
UNWIND mine AS known
MATCH (known)<-[:PURCHASED]-(peer:User)
WHERE peer <> me
WITH mine, peer, count(DISTINCT known) AS shared
// Jaccard-style similarity: overlap divided by everything either of us bought.
WITH mine, peer,
     toFloat(shared) / (size(mine) + COUNT { (peer)-[:PURCHASED]->() } - shared) AS similarity
ORDER BY similarity DESC, peer.id
LIMIT 25
// What do my nearest peers own that I do not?
MATCH (peer)-[:PURCHASED]->(candidate:Product)
WHERE NOT candidate IN mine
WITH DISTINCT candidate, peer, similarity
WITH candidate, sum(similarity) AS score, collect(peer) AS peers
ORDER BY score DESC, candidate.id
LIMIT $limit
RETURN candidate.id AS productId, score,
       [peer IN peers | peer.name][..3] AS names, size(peers) AS evidenceTotal,
       [peer IN peers[..12] | {kind:'User',key:peer.id,label:peer.name}] AS peers,
       [{kind:'Product',key:candidate.id,label:candidate.name}] AS products,
       [] AS evidence
`

const SOCIAL_QUERY = `
// SHORTEST 1 retains each reachable buyer once at their nearest follow distance.
MATCH path=SHORTEST 1 (me:User {id:$userId})-[:FOLLOWS]->{1,2}(peer:User)
WITH me, peer, length(path) AS distance
ORDER BY distance, peer.id
MATCH (peer)-[:PURCHASED]->(candidate:Product)
WHERE NOT EXISTS { MATCH (me)-[:PURCHASED]->(candidate) }
WITH candidate, peer, distance, 1.0 / distance AS weight
WITH candidate, sum(weight) AS score, collect(DISTINCT peer) AS peers
RETURN candidate.id AS productId, score,
       [peer IN peers | peer.name][..3] AS names, size(peers) AS evidenceTotal,
       [peer IN peers[..12] | {kind:'User',key:peer.id,label:peer.name}] AS peers,
       [{kind:'Product',key:candidate.id,label:candidate.name}] AS products,
       [] AS evidence
ORDER BY score DESC, productId
LIMIT $limit
`

const CATEGORY_QUERY = `
// A bounded category hierarchy traversal relates viewed and purchased leaf categories.
MATCH (me:User {id:$userId})-[:PURCHASED|VIEWED]->(known:Product)-[:IN_CATEGORY]->(category:Category)
MATCH (category)-[:SUBCATEGORY_OF*0..2]-(related:Category)<-[:IN_CATEGORY]-(candidate:Product)
WHERE NOT EXISTS { MATCH (me)-[:PURCHASED]->(candidate) }
WITH candidate, count(DISTINCT category) AS score, collect(DISTINCT category.name) AS knownCategories
ORDER BY score DESC, candidate.id
LIMIT $limit
// The explanation graph shows each recommended product's actual category.
MATCH (candidate)-[:IN_CATEGORY]->(own:Category)
WITH candidate, score, knownCategories, collect(own) AS categories
RETURN candidate.id AS productId, score,
       knownCategories[..3] AS names, size(knownCategories) AS evidenceTotal,
       [] AS peers,
       [{kind:'Product',key:candidate.id,label:candidate.name}] AS products,
       [category IN categories | {kind:'Category',key:category.id,label:category.name}] AS evidence
ORDER BY score DESC, productId
`

const QUERY_BY_STRATEGY: Record<RecommendationStrategy, string> = {
  collaborative: COLLABORATIVE_QUERY,
  social: SOCIAL_QUERY,
  category: CATEGORY_QUERY,
}

/** Each strategy excludes previously purchased products and returns graph evidence for its explanation. */
export async function recommend(
  userId: number,
  strategy: RecommendationStrategy,
  limit: number,
  tracer?: Tracer,
): Promise<RecommendationsResponse> {
  const rows = await readCypher<RecommendationRow>(
    QUERY_BY_STRATEGY[strategy],
    { userId: int(userId), limit: int(limit) },
    { tracer, operation: `Recommendations (${strategy})`, timeoutMs: GRAPH_TIMEOUT_MS },
  )
  const hydrated = await findProductSummaries(
    rows.map((row) => row.productId),
    tracer,
  )
  const items: RecommendedProduct[] = rows.flatMap((row) => {
    const product = hydrated.get(row.productId)
    return product
      ? [
          {
            product,
            score: Math.round(row.score * 100) / 100,
            reasons: [recommendationReason(strategy, row.names, row.evidenceTotal)],
          },
        ]
      : []
  })
  const nodes = [
    ...rows.flatMap((row) => row.products),
    ...rows.flatMap((row) => row.evidence),
    ...rows.flatMap((row) => row.peers.slice(0, 12)),
    ...(strategy === 'category' ? [{ kind: 'User', key: userId, label: `User ${userId}` }] : []),
  ]
  const edges = buildEvidenceEdges(rows, strategy)
  return { strategy, items, graph: buildGraph(nodes, edges), trace: tracer?.entries ?? [] }
}

function buildEvidenceEdges(rows: RecommendationRow[], strategy: RecommendationStrategy): GraphEdgeInput[] {
  return rows.flatMap((row) => {
    if (strategy === 'category') {
      return row.evidence.flatMap((category) =>
        row.products.map((product) => ({
          type: 'IN_CATEGORY',
          sourceKind: 'Product',
          sourceKey: product.key,
          targetKind: 'Category',
          targetKey: category.key,
        })),
      )
    }
    return row.peers.flatMap((peer) =>
      row.products.map((product) => ({
        type: 'PURCHASED',
        sourceKind: 'User',
        sourceKey: peer.key,
        targetKind: 'Product',
        targetKey: product.key,
      })),
    )
  })
}
