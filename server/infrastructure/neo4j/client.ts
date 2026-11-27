import neo4j, { type Driver, type QueryResult, type RecordShape } from 'neo4j-driver'
import { config } from '../config'
import type { Tracer } from '../trace'

let driver: Driver | null = null

export function neo4jDriver(): Driver {
  driver ??= neo4j.driver(config.NEO4J_URI, neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD), {
    // Ids and counts fit in a JS number; avoids neo4j.Integer wrappers everywhere.
    disableLosslessIntegers: true,
    connectionAcquisitionTimeout: 4000,
    connectionTimeout: 4000,
    // Fail fast during an outage, so pages degrade instead of hanging for the default 30 seconds.
    maxTransactionRetryTime: 3000,
  })
  return driver
}

export interface CypherOptions {
  tracer?: Tracer
  /** Label shown in the query trace. */
  operation?: string
  timeoutMs?: number
}

/**
 * JS numbers are sent as FLOAT. Use `int()` for LIMIT/SKIP parameters and for
 * every id or integer property you write.
 */
export const int = (value: number) => neo4j.int(value)

async function execute<T extends RecordShape>(
  mode: 'READ' | 'WRITE',
  cypher: string,
  params: Record<string, unknown>,
  options: CypherOptions,
): Promise<T[]> {
  const work = async () => {
    const result = await neo4jDriver().executeQuery<QueryResult<T>>(cypher, params, {
      database: config.NEO4J_DATABASE,
      routing: mode === 'READ' ? neo4j.routing.READ : neo4j.routing.WRITE,
      transactionConfig: options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
    })
    return result.records.map((record) => record.toObject() as T)
  }
  if (!options.tracer) return work()
  const shown = Object.keys(params).length
    ? `// params: ${JSON.stringify(params).slice(0, 400)}\n${cypher.trim()}`
    : cypher.trim()
  return options.tracer.run('neo4j', options.operation ?? 'cypher', shown, work)
}

/** Runs a read query in a managed (auto retried) transaction and returns plain objects. */
export function readCypher<T extends RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
  options: CypherOptions = {},
): Promise<T[]> {
  return execute<T>('READ', cypher, params, options)
}

/** Runs a write query in a managed transaction and returns plain objects. */
export function writeCypher<T extends RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
  options: CypherOptions = {},
): Promise<T[]> {
  return execute<T>('WRITE', cypher, params, options)
}

export async function closeNeo4j(): Promise<void> {
  await driver?.close()
  driver = null
}
