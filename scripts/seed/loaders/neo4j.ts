import type { Dataset } from '../generate'
import { config } from '../../../server/infrastructure/config'
import { int, neo4jDriver } from '../../../server/infrastructure/neo4j/client'
import { ensureNeo4jSchema } from '../../../server/infrastructure/neo4j/schema'
import { rebuildProjections } from '../../../server/modules/sync/graph-loader'

const batchSize = 1_000

export async function loadNeo4j(data: Dataset): Promise<void> {
  await ensureNeo4jSchema()
  const session = neo4jDriver().session({ database: config.NEO4J_DATABASE })
  try {
    // The seed owns the whole demo graph, so remove every node before rebuilding its projections.
    await session.run(`
      MATCH (node)
      CALL { WITH node DETACH DELETE node } IN TRANSACTIONS OF 10000 ROWS
    `)
  } finally {
    await session.close()
  }

  await ensureNeo4jSchema()
  await rebuildProjections()
  await writeFollows(data)
  await writeRoutes(data)
}

async function writeFollows(data: Dataset): Promise<void> {
  const rows = data.follows.map((follow) => ({
    followerId: follow.followerId,
    followeeId: follow.followeeId,
    since: follow.since.toISOString(),
  }))
  await writeBatches(
    `
    UNWIND $rows AS row
    MATCH (follower:User {id: row.followerId})
    MATCH (followee:User {id: row.followeeId})
    MERGE (follower)-[relationship:FOLLOWS]->(followee)
    SET relationship.since = datetime(row.since)
  `,
    rows,
  )
}

async function writeRoutes(data: Dataset): Promise<void> {
  await writeBatches(
    `
    UNWIND $rows AS row
    MATCH (source:Warehouse {id: row.fromId})
    MATCH (destination:Warehouse {id: row.toId})
    MERGE (source)-[relationship:ROUTE_TO]->(destination)
    SET relationship.distanceKm = row.distanceKm,
        relationship.durationMin = row.durationMin
  `,
    data.routes,
  )
}

async function writeBatches(cypher: string, rows: Record<string, unknown>[]): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize).map(convertNeo4jValues)
    await neo4jDriver().executeQuery(cypher, { rows: batch }, { database: config.NEO4J_DATABASE })
  }
}

function convertNeo4jValues(value: unknown): unknown {
  if (typeof value === 'number' && Number.isInteger(value)) return int(value)
  if (Array.isArray(value)) return value.map(convertNeo4jValues)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, convertNeo4jValues(nested)]))
  }
  return value
}
