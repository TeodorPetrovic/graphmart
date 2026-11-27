/** What the configured databases currently hold, and how to reach them. */
import { config } from '../../server/infrastructure/config'
import { supportsTransactions } from '../../server/infrastructure/mongo/atomic'
import { mongoClient, mongoDb } from '../../server/infrastructure/mongo/client'
import { sqlQuery } from '../../server/infrastructure/mysql/client'
import { readCypher } from '../../server/infrastructure/neo4j/client'

export const ENGINES = ['mongo', 'mysql', 'neo4j'] as const
export type Engine = (typeof ENGINES)[number]

export interface TargetState {
  name: string
  address: string
  version: string
  /** Rows, documents or nodes already stored. */
  records: number
  note?: string
}

/** Never print a password that is part of a connection string. */
const withoutPassword = (uri: string) => uri.replace(/\/\/([^/@:]+):[^/@]*@/, '//$1:***@')

async function mongoState(): Promise<TargetState> {
  const info = await mongoClient().db('admin').command({ buildInfo: 1 })
  const db = mongoDb()
  let records = 0
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (!name.startsWith('system.')) records += await db.collection(name).countDocuments()
  }
  return {
    name: 'MongoDB',
    address: `${withoutPassword(config.MONGO_URI)} database "${config.MONGO_DB}"`,
    version: String(info.version),
    records,
    note: (await supportsTransactions())
      ? 'replica set: transactions and change streams are used'
      : 'single server: no transactions or change streams (see README)',
  }
}

async function mysqlState(): Promise<TargetState> {
  const [{ version } = { version: 'unknown' }] = await sqlQuery<{ version: string }>('SELECT VERSION() AS version')
  const tables = await sqlQuery<{ name: string }>(
    'SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = ?',
    [config.MYSQL_DATABASE],
  )
  let records = 0
  for (const { name } of tables) {
    const [row] = await sqlQuery<{ total: number }>('SELECT COUNT(*) AS total FROM ??', [name])
    records += Number(row?.total ?? 0)
  }
  return {
    name: 'MySQL',
    address: `${config.MYSQL_HOST}:${config.MYSQL_PORT} database "${config.MYSQL_DATABASE}"`,
    version,
    records,
  }
}

async function neo4jState(): Promise<TargetState> {
  const [component] = await readCypher<{ version: string }>(
    'CALL dbms.components() YIELD versions RETURN versions[0] AS version',
  )
  const [count] = await readCypher<{ total: number }>('MATCH (n) RETURN count(n) AS total')
  return {
    name: 'Neo4j',
    address: `${config.NEO4J_URI} database "${config.NEO4J_DATABASE}"`,
    version: component?.version ?? 'unknown',
    records: count?.total ?? 0,
  }
}

const PROBES: Record<Engine, { run: () => Promise<TargetState>; settings: string }> = {
  mongo: { run: mongoState, settings: 'MONGO_URI' },
  mysql: { run: mysqlState, settings: 'MYSQL_HOST, MYSQL_PORT, MYSQL_USER and MYSQL_PASSWORD' },
  neo4j: { run: neo4jState, settings: 'NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD' },
}

/** Connects to one database, turning a failure into a message that says what to change. */
export async function targetState(engine: Engine): Promise<TargetState> {
  const probe = PROBES[engine]
  try {
    return await probe.run()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${engine}: ${reason}\n  Is it running? Check ${probe.settings} in .env.`)
  }
}

/**
 * Loading data deletes what is in the target. Stop before that happens unless the target
 * is empty or the caller passed --replace.
 */
export async function assertSafeToLoad(engines: Iterable<Engine>, replace: boolean): Promise<void> {
  const occupied: string[] = []
  for (const engine of engines) {
    const state = await targetState(engine)
    if (state.records > 0) occupied.push(`${state.name} at ${state.address} holds ${state.records} records`)
  }
  if (occupied.length && !replace) {
    throw new Error(
      `Nothing was changed. Loading would delete existing data:\n  ${occupied.join('\n  ')}\n` +
        'If you want to delete it, run the same command again with --replace.',
    )
  }
}

export function parseEngines(list: string): Set<Engine> {
  return new Set(
    list.split(',').map((name) => {
      const engine = ENGINES.find((item) => item === name)
      if (!engine) throw new Error(`Unknown database "${name}". Use ${ENGINES.join(', ')}.`)
      return engine
    }),
  )
}
