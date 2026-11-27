import type { RowDataPacket } from 'mysql2/promise'
import type { EngineHealth } from '../../../shared/types/api'
import { config } from '../../infrastructure/config'
import { collections, mongoClient } from '../../infrastructure/mongo/client'
import { mysqlPool } from '../../infrastructure/mysql/client'
import { readCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'

type EngineStats = Record<string, number> | null

interface MongoCountQuery {
  name: string
  query: string
  count: () => Promise<number>
}

interface MysqlVersionRow extends RowDataPacket {
  version: string
}

interface MysqlTableName extends RowDataPacket {
  TABLE_NAME: string
}

interface MysqlTableCount extends RowDataPacket {
  name: string
  total: number
}

interface Neo4jNodeCount {
  label: string
  count: number
}

interface Neo4jVersionRow {
  version: string
}

interface Neo4jRelationshipCount {
  type: string
  count: number
}

interface Neo4jStats {
  nodes: EngineStats
  relationships: EngineStats
}

async function checkEngine(work: () => Promise<string>): Promise<EngineHealth> {
  const startedAt = performance.now()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const version = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Health check timed out')), 1500)
      }),
    ])
    return { ok: true, version, latencyMs: elapsedMs(startedAt), error: null }
  } catch (error) {
    return {
      ok: false,
      version: null,
      latencyMs: elapsedMs(startedAt),
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function elapsedMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100
}

async function mysqlVersion(): Promise<string> {
  const [rows] = await mysqlPool().query<MysqlVersionRow[]>('SELECT VERSION() AS version')
  return String(rows[0]?.version ?? 'unknown')
}

async function mongoVersion(): Promise<string> {
  const result = await mongoClient().db().command({ buildInfo: 1 })
  return String(result.version ?? 'unknown')
}

async function neo4jVersion(): Promise<string> {
  const cypher = `
CALL dbms.components()
YIELD versions
RETURN versions[0] AS version
`
  const [row] = await readCypher<Neo4jVersionRow>(cypher, {}, { timeoutMs: 1200 })
  return row?.version ?? 'unknown'
}

/** Each health probe has its own timeout, so one unavailable engine cannot hide the others. */
export async function engineHealth() {
  const [mysql, mongo, neo4j] = await Promise.all([
    checkEngine(mysqlVersion),
    checkEngine(mongoVersion),
    checkEngine(neo4jVersion),
  ])
  return { mysql, mongo, neo4j }
}

async function mongoStats(tracer: Tracer): Promise<EngineStats> {
  const db = collections()
  const countQueries: MongoCountQuery[] = [
    { name: 'users', query: 'db.users.countDocuments()', count: () => db.users.countDocuments() },
    { name: 'products', query: 'db.products.countDocuments()', count: () => db.products.countDocuments() },
    { name: 'categories', query: 'db.categories.countDocuments()', count: () => db.categories.countDocuments() },
    { name: 'orders', query: 'db.orders.countDocuments()', count: () => db.orders.countDocuments() },
    { name: 'reviews', query: 'db.reviews.countDocuments()', count: () => db.reviews.countDocuments() },
    {
      name: 'product_views',
      query: 'db.product_views.countDocuments()',
      count: () => db.productViews.countDocuments(),
    },
    { name: 'warehouses', query: 'db.warehouses.countDocuments()', count: () => db.warehouses.countDocuments() },
    { name: 'outbox', query: 'db.outbox.countDocuments()', count: () => db.outbox.countDocuments() },
    { name: 'counters', query: 'db.counters.countDocuments()', count: () => db.counters.countDocuments() },
  ]
  try {
    const counts = await Promise.all(
      countQueries.map(async ({ name, query, count }) => [
        name,
        await tracer.run('mongo', `Count ${name}`, query, count),
      ]),
    )
    return Object.fromEntries(counts)
  } catch {
    return null
  }
}

async function mysqlStats(tracer: Tracer): Promise<EngineStats> {
  const listQuery = 'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? ORDER BY TABLE_NAME'
  try {
    const [tables] = await mysqlPool().query<MysqlTableName[]>(listQuery, [config.MYSQL_DATABASE])
    if (tables.length === 0) return {}
    // information_schema.TABLE_ROWS is only an InnoDB estimate, so every table is counted exactly.
    const countQuery = tables
      .map(({ TABLE_NAME }) => `SELECT '${TABLE_NAME}' AS name, COUNT(*) AS total FROM \`${TABLE_NAME}\``)
      .join('\nUNION ALL\n')
    return await tracer.run('mysql', 'Count legacy tables', countQuery, async () => {
      const [rows] = await mysqlPool().query<MysqlTableCount[]>(countQuery)
      return Object.fromEntries(rows.map((row) => [row.name, Number(row.total)]))
    })
  } catch {
    return null
  }
}

async function neo4jStats(tracer: Tracer): Promise<Neo4jStats> {
  const nodeQuery = `
MATCH (node)
UNWIND labels(node) AS label
RETURN label, count(*) AS count
`
  const relationshipQuery = `
MATCH ()-[relationship]->()
RETURN type(relationship) AS type, count(*) AS count
`
  try {
    const [nodes, relationships] = await Promise.all([
      readCypher<Neo4jNodeCount>(nodeQuery, {}, { tracer, operation: 'Count graph nodes' }),
      readCypher<Neo4jRelationshipCount>(relationshipQuery, {}, { tracer, operation: 'Count graph relationships' }),
    ])
    return {
      nodes: Object.fromEntries(nodes.map(({ label, count }) => [label, count])),
      relationships: Object.fromEntries(relationships.map(({ type, count }) => [type, count])),
    }
  } catch {
    return { nodes: null, relationships: null }
  }
}

export async function databaseStats(tracer: Tracer) {
  const [mongo, mysql, neo4j] = await Promise.all([mongoStats(tracer), mysqlStats(tracer), neo4jStats(tracer)])
  return {
    mongo,
    mysql,
    neo4jNodes: neo4j.nodes,
    neo4jRelationships: neo4j.relationships,
  }
}
