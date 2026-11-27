import { GRAPH_TIMEOUT_MS } from '../graph/limits'
import type { FraudRing, FraudRingsResponse } from '../../../shared/types/api'
import { int, readCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'
import { buildGraph, type GraphEdgeInput, type GraphNodeInput } from '../graph/dto'
import { fraudRisk, groupFraudLinks, type FraudLink } from './logic'

interface FraudPairRow {
  left: number
  right: number
  leftName: string
  rightName: string
  kind: 'Device' | 'Card' | 'Address'
  resourceKey: string
}

const FRAUD_PAIRS_QUERY = `
// Direct shared identity nodes form deterministic candidate user pairs.
MATCH (left:User)-[:USED_DEVICE|PAID_WITH|SHIPS_TO]->(identity)<-[:USED_DEVICE|PAID_WITH|SHIPS_TO]-(right:User)
WHERE left.id < right.id
  AND COUNT { (identity)<-[:USED_DEVICE|PAID_WITH|SHIPS_TO]-(user:User) } > 1
WITH DISTINCT left, right, identity
// One row per shared node keeps every signal while avoiding pairwise path expansion.
RETURN left.id AS left, right.id AS right,
       left.name AS leftName, right.name AS rightName,
       CASE WHEN identity:Device THEN 'Device'
            WHEN identity:Card THEN 'Card'
            ELSE 'Address' END AS kind,
       CASE WHEN identity:Device THEN toString(identity.id)
            WHEN identity:Card THEN identity.fingerprint
            ELSE identity.key END AS resourceKey
ORDER BY left.id, right.id, kind, resourceKey
`

/** Shared-resource pairs are complete; pure code then joins them into connected components. */
export async function rings(minUsers: number, limit: number, tracer?: Tracer): Promise<FraudRingsResponse> {
  const rows = await readCypher<FraudPairRow>(
    FRAUD_PAIRS_QUERY,
    {},
    {
      tracer,
      operation: 'Shared identity pairs',
      timeoutMs: GRAPH_TIMEOUT_MS,
    },
  )
  const links: FraudLink[] = rows.map((row) => ({
    left: row.left,
    right: row.right,
    device: row.kind === 'Device' ? row.resourceKey : null,
    card: row.kind === 'Card' ? row.resourceKey : null,
    address: row.kind === 'Address' ? row.resourceKey : null,
  }))
  const groups = groupFraudLinks(links, minUsers)
  const names = new Map<number, string>()

  for (const row of rows) {
    names.set(row.left, row.leftName)
    names.set(row.right, row.rightName)
  }

  const rings: FraudRing[] = groups.map((group) => ({
    id: `ring-${group.userIds.join('-')}`,
    userIds: group.userIds,
    userNames: group.userIds.map((id) => names.get(id) ?? `User ${id}`),
    sharedDevices: group.devices.size,
    sharedCards: group.cards.size,
    sharedAddresses: group.addresses.size,
    riskScore: fraudRisk(group.userIds.length, group.devices.size, group.cards.size, group.addresses.size),
  }))

  rings.sort(
    (left, right) =>
      right.riskScore - left.riskScore || right.userIds.length - left.userIds.length || left.id.localeCompare(right.id),
  )
  return { rings: rings.slice(0, limit), trace: tracer?.entries ?? [] }
}

interface FraudUserRow {
  id: number
  name: string
  links: { otherId: number; otherName: string; mine: string; theirs: string; kind: string; key: string }[]
}

const FRAUD_USER_QUERY = `
MATCH (user:User {id:$userId})
// A scoped subquery walks user -> shared thing <- other account, one row per link.
CALL (user) {
  OPTIONAL MATCH (user)-[mine:USED_DEVICE|PAID_WITH|SHIPS_TO]->(shared)<-[theirs:USED_DEVICE|PAID_WITH|SHIPS_TO]-(other:User)
  WITH user, mine, shared, theirs, other
  WHERE other IS NOT NULL AND other <> user
  ORDER BY other.id
  LIMIT 60
  RETURN collect({
    otherId: other.id, otherName: other.name, mine: type(mine), theirs: type(theirs),
    kind: labels(shared)[0], key: coalesce(shared.id, shared.fingerprint, shared.key)
  }) AS links
}
RETURN user.id AS id, user.name AS name, links
`

const IDENTITY_SIGNALS = [
  { kind: 'Card', label: 'Shared payment card', noun: 'payment card(s)', weight: 35 },
  { kind: 'Device', label: 'Shared device', noun: 'device(s)', weight: 30 },
  { kind: 'Address', label: 'Shared delivery address', noun: 'address(es)', weight: 15 },
]

/** The accounts connected to one user, why they are connected, and the risk that follows. */
export async function fraudUser(userId: number, tracer?: Tracer) {
  const [row] = await readCypher<FraudUserRow>(
    FRAUD_USER_QUERY,
    { userId: int(userId) },
    { tracer, operation: 'Fraud user signals', timeoutMs: GRAPH_TIMEOUT_MS },
  )
  if (!row) throw new Error('Unknown user')

  const sharedKeys = (kind: string) => new Set(row.links.filter((link) => link.kind === kind).map((link) => link.key))
  const accounts = new Set([row.id, ...row.links.map((link) => link.otherId)]).size
  const signals = IDENTITY_SIGNALS.flatMap(({ kind, label, noun, weight }) => {
    const count = sharedKeys(kind).size
    return count ? [{ label, detail: `${count} ${noun}`, weight }] : []
  })
  const groupWeight = Math.max(0, accounts - 2) * 10
  if (groupWeight) {
    signals.push({ label: 'Size of the group', detail: `${accounts} accounts are linked`, weight: groupWeight })
  }

  const nodes: GraphNodeInput[] = [
    { kind: 'User', key: row.id, label: row.name, highlight: true },
    ...row.links.flatMap((link) => [
      { kind: link.kind, key: link.key, label: link.kind === 'Card' ? 'Payment card' : link.key },
      { kind: 'User', key: link.otherId, label: link.otherName },
    ]),
  ]
  const edges: GraphEdgeInput[] = row.links.flatMap((link) => [
    { type: link.mine, sourceKind: 'User', sourceKey: row.id, targetKind: link.kind, targetKey: link.key },
    { type: link.theirs, sourceKind: 'User', sourceKey: link.otherId, targetKind: link.kind, targetKey: link.key },
  ])
  // Later duplicates replace earlier ones, so the reviewed user is listed last to stay highlighted.
  const graph = buildGraph([...nodes, nodes[0]!], edges)

  return {
    user: { id: row.id, name: row.name },
    riskScore: fraudRisk(accounts, sharedKeys('Device').size, sharedKeys('Card').size, sharedKeys('Address').size),
    signals,
    graph,
    trace: tracer?.entries ?? [],
  }
}

interface ReferralCycleRow {
  cycle: { id: number; name: string }[]
  nodes: GraphNodeInput[]
  edges: GraphEdgeInput[]
  length: number
}

const REFERRAL_CYCLES_QUERY = `
// Bounded directed paths use the minimum member as canonical start for each cycle.
MATCH path=(start:User)-[:REFERRED*1..8]->(start)
WITH path, nodes(path) AS cycle
WHERE size(cycle) > 1
  AND cycle[0].id = reduce(minimum = cycle[0].id, member IN cycle |
    CASE WHEN member.id < minimum THEN member.id ELSE minimum END)
WITH path, cycle[0..-1] AS members
RETURN [member IN members | {id:member.id,name:member.name}] AS cycle,
       [member IN members | {kind:'User',key:member.id,label:member.name}] AS nodes,
       [relationship IN relationships(path) |
         {type:'REFERRED',sourceKind:'User',sourceKey:startNode(relationship).id,
          targetKind:'User',targetKey:endNode(relationship).id}] AS edges,
       length(path) AS length
ORDER BY length, cycle[0].id
`

/** The repeated terminal start node is omitted; canonical starts report each directed cycle once. */
export async function referralCycles(tracer?: Tracer) {
  const rows = await readCypher<ReferralCycleRow>(
    REFERRAL_CYCLES_QUERY,
    {},
    {
      tracer,
      operation: 'Referral cycles',
      timeoutMs: GRAPH_TIMEOUT_MS,
    },
  )
  return {
    cycles: rows.map((row) => ({
      userIds: row.cycle.map((user) => user.id),
      userNames: row.cycle.map((user) => user.name),
      length: row.length,
    })),
    graph: buildGraph(
      rows.flatMap((row) => row.nodes),
      rows.flatMap((row) => row.edges),
    ),
    trace: tracer?.entries ?? [],
  }
}
