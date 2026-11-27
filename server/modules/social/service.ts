import type {
  FollowResponse,
  NetworkResponse,
  PathResponse,
  ReferralResponse,
  SuggestionsResponse,
} from '../../../shared/types/api'
import { int, readCypher, writeCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'
import { GRAPH_TIMEOUT_MS as GRAPH_TIMEOUT } from '../graph/limits'
import { buildGraph, type GraphEdgeInput, type GraphNodeInput } from '../graph/dto'

type NodeRow = GraphNodeInput[]
type EdgeRow = GraphEdgeInput[]

/** Variable-length traversal is bounded, and DISTINCT by minimum depth prevents diamond paths multiplying counts. */
export async function network(userId: number, depth: number, limit: number, tracer?: Tracer): Promise<NetworkResponse> {
  const cypher = `
// Variable-length traversal finds minimum distance for the complete reachable set.
MATCH (root:User {id:$userId})
CALL (root) {
  MATCH path=(root)-[:FOLLOWS*1..${depth}]->(user:User)
  WHERE user <> root
  WITH user, min(length(path)) AS depth
  RETURN collect({id:user.id,depth:depth}) AS allDepths
}
// The display cap applies only to paths and graph payload, never to depth counts.
CALL (root) {
  MATCH path=(root)-[:FOLLOWS*1..${depth}]->(user:User)
  WHERE user <> root
  WITH user, min(length(path)) AS depth
  ORDER BY depth, user.id
  LIMIT $limit
  RETURN collect({id:user.id,depth:depth}) AS displayedUsers
}
CALL (root, displayedUsers) {
  UNWIND displayedUsers AS displayed
  MATCH (user:User {id:displayed.id})
  MATCH path=SHORTEST 1 (root)-[:FOLLOWS]->{1,${depth}}(user)
  RETURN collect(path) AS paths
}
RETURN [{kind:'User',key:root.id,label:root.name,props:{city:root.city}}]
       + reduce(nodes=[],path IN paths | nodes +
         [node IN nodes(path) | {kind:'User',key:node.id,label:node.name,props:{city:node.city}}]) AS nodes,
       reduce(edges=[],path IN paths | edges +
         [relationship IN relationships(path) |
           {type:'FOLLOWS',sourceKind:'User',sourceKey:startNode(relationship).id,
            targetKind:'User',targetKey:endNode(relationship).id}]) AS edges,
       allDepths AS depths
`
  const [row] = await readCypher<{ nodes: NodeRow; edges: EdgeRow; depths: { depth: number; id: number }[] }>(
    cypher,
    { userId: int(userId), limit: int(limit) },
    { tracer, operation: 'Follow network', timeoutMs: GRAPH_TIMEOUT },
  )
  const countsByDepth = [1, 2, 3]
    .slice(0, depth)
    .map((d) => ({ depth: d, users: new Set((row?.depths ?? []).filter((x) => x.depth === d).map((x) => x.id)).size }))
  return { graph: buildGraph(row?.nodes ?? [], row?.edges ?? []), countsByDepth, trace: tracer?.entries ?? [] }
}

/** Friends of friends ranked by mutual connections, with shared purchases as a second signal. */
export async function suggestions(userId: number, limit: number, tracer?: Tracer): Promise<SuggestionsResponse> {
  const cypher = `
// Two FOLLOWS hops give the candidates; EXISTS removes the ones I already follow.
MATCH (me:User {id:$userId})-[:FOLLOWS]->(mutual:User)-[:FOLLOWS]->(candidate:User)
WHERE candidate <> me AND NOT EXISTS { (me)-[:FOLLOWS]->(candidate) }
WITH me, candidate, collect(mutual.name) AS names
// Shortlist by mutual connections before computing the more expensive signal.
ORDER BY size(names) DESC, candidate.id
LIMIT 100
WITH me, candidate, names, COLLECT { MATCH (me)-[:PURCHASED]->(product:Product) RETURN DISTINCT product } AS mine
// A scoped subquery counts the products we both bought, expanding from the candidate.
CALL (candidate, mine) {
  MATCH (candidate)-[:PURCHASED]->(product:Product)
  WHERE product IN mine
  RETURN count(DISTINCT product) AS shared
}
RETURN candidate.id AS id, candidate.name AS name, candidate.city AS city,
       size(names) AS mutualCount, 2 AS distance, names[0..5] AS mutualNames,
       size(names) * 3 + shared AS score
ORDER BY score DESC, id
LIMIT $limit
`
  const rows = await readCypher<{
    id: number
    name: string
    city: string
    mutualCount: number
    distance: number
    mutualNames: string[]
    score: number
  }>(
    cypher,
    { userId: int(userId), limit: int(limit) },
    { tracer, operation: 'People you may know', timeoutMs: GRAPH_TIMEOUT },
  )
  return {
    suggestions: rows.map((row) => ({
      user: { id: row.id, name: row.name, city: row.city },
      mutualCount: row.mutualCount,
      distance: row.distance,
      mutualNames: row.mutualNames,
      score: row.score,
    })),
    trace: tracer?.entries ?? [],
  }
}

/** SHORTEST k returns distinct shortest follow paths and marks their nodes and edges in the graph. */
export async function shortestPaths(
  from: number,
  to: number,
  maxDepth: number,
  tracer?: Tracer,
): Promise<PathResponse> {
  const cypher = `
// SHORTEST 3 returns up to three distinct shortest paths within the validated depth bound.
MATCH (origin:User {id:$from}), (destination:User {id:$to})
MATCH path = SHORTEST 3 (origin)-[:FOLLOWS]->{1,${maxDepth}}(destination)
RETURN [node IN nodes(path) |
         {kind:'User',key:node.id,label:node.name,props:{city:node.city}}] AS nodes,
       [relationship IN relationships(path) |
         {type:type(relationship),sourceKind:'User',sourceKey:startNode(relationship).id,
          targetKind:'User',targetKey:endNode(relationship).id}] AS edges,
       [node IN nodes(path) | {id:node.id,name:node.name}] AS path,
       length(path) AS length
`
  const rows = await readCypher<{
    nodes: NodeRow
    edges: EdgeRow
    path: { id: number; name: string }[]
    length: number
  }>(cypher, { from: int(from), to: int(to) }, { tracer, operation: 'Shortest follow paths', timeoutMs: GRAPH_TIMEOUT })
  const paths = rows.map((r) => r.path)
  const graph = buildGraph(
    rows.flatMap((r) => r.nodes),
    rows.flatMap((r) => r.edges),
    paths.flatMap((p) => p.map((n) => `User:${n.id}`)),
  )
  graph.edges.forEach((edge) => {
    edge.highlight = true
  })
  return { found: rows.length > 0, length: rows[0]?.length ?? null, graph, paths, trace: tracer?.entries ?? [] }
}

/** Relationship ownership stays in Neo4j; MERGE makes follow idempotent and self edges are rejected by the caller. */
export async function follow(
  followerId: number,
  followeeId: number,
  enable: boolean,
  tracer?: Tracer,
): Promise<FollowResponse> {
  const cypher = enable
    ? `
// MERGE makes following idempotent while preserving the original relationship timestamp.
OPTIONAL MATCH (follower:User {id:$followerId})
OPTIONAL MATCH (followee:User {id:$followeeId})
WITH follower, followee
FOREACH (_ IN CASE WHEN follower IS NOT NULL AND followee IS NOT NULL THEN [1] ELSE [] END |
  MERGE (follower)-[relationship:FOLLOWS]->(followee)
  ON CREATE SET relationship.since = datetime())
RETURN follower IS NOT NULL AS followerExists, followee IS NOT NULL AS followeeExists
`
    : `
// Optional matches distinguish missing users from an already absent relationship.
OPTIONAL MATCH (follower:User {id:$followerId})
OPTIONAL MATCH (followee:User {id:$followeeId})
OPTIONAL MATCH (follower)-[relationship:FOLLOWS]->(followee)
DELETE relationship
RETURN follower IS NOT NULL AS followerExists, followee IS NOT NULL AS followeeExists
`
  const [row] = await writeCypher<{ followerExists: boolean; followeeExists: boolean }>(
    cypher,
    {
      followerId: int(followerId),
      followeeId: int(followeeId),
    },
    { tracer, operation: enable ? 'Follow user' : 'Unfollow user' },
  )
  if (!row?.followerExists || !row.followeeExists) throw new Error('Unknown user')
  return { following: enable, trace: tracer?.entries ?? [] }
}

/** Referral traversal is bounded and cycle-safe; revenue rolls up PURCHASED quantity times current product cents by level. */
export async function referrals(userId: number, tracer?: Tracer): Promise<ReferralResponse> {
  const cypher = `
// Bounded referral traversal is reduced to one minimum depth per descendant.
MATCH (root:User {id:$userId})
CALL (root) {
  MATCH path=(root)-[:REFERRED*1..5]->(user:User)
  WHERE user <> root
  WITH user, min(length(path)) AS level
  RETURN collect({id:user.id,level:level}) AS members,
         collect({kind:'User',key:user.id,label:user.name,props:{city:user.city,level:level}}) AS descendants
}
CALL (root) {
  MATCH (root)-[:REFERRED*0..5]->(user:User)
  RETURN collect(DISTINCT {kind:'User',key:user.id,label:user.name}) AS rootNodes
}
CALL (root) {
  MATCH path=(root)-[:REFERRED*1..5]->(:User)
  UNWIND relationships(path) AS relationship
  RETURN collect(DISTINCT {
    type:'REFERRED',sourceKind:'User',sourceKey:startNode(relationship).id,
    targetKind:'User',targetKey:endNode(relationship).id
  }) AS edges
}
CALL (root) {
  MATCH path=(root)-[:REFERRED*1..5]->(user:User)
  WHERE user <> root
  WITH user, min(length(path)) AS level
  OPTIONAL MATCH (user)-[purchase:PURCHASED]->(product:Product)
  WITH level, user, sum(coalesce(purchase.quantity,0) * coalesce(product.priceCents,0)) AS spend
  WITH level, count(DISTINCT user) AS users, sum(spend) AS revenueCents
  RETURN level, users, revenueCents
}
WITH root, descendants + rootNodes AS nodes, edges,
     collect({level:level,users:users,revenueCents:revenueCents}) AS levels
RETURN nodes, edges, levels
`
  const [row] = await readCypher<{
    nodes: NodeRow
    edges: EdgeRow
    levels: { level: number; users: number; revenueCents: number }[]
  }>(cypher, { userId: int(userId) }, { tracer, operation: 'Referral tree', timeoutMs: GRAPH_TIMEOUT })
  return {
    graph: buildGraph(row?.nodes ?? [], row?.edges ?? []),
    levels: row?.levels ?? [],
    trace: tracer?.entries ?? [],
  }
}
