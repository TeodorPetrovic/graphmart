import neo4j, { type ProfiledPlan } from 'neo4j-driver'
import type { ExplainResponse } from '../../../../shared/types/api'
import { config } from '../../../infrastructure/config'
import { int, neo4jDriver } from '../../../infrastructure/neo4j/client'
import type { EngineQuery, Params } from '../types'

export interface Neo4jSpec {
  label: string
  notes: string[]
  /** A function is only needed for variable length bounds, which Cypher cannot parameterise. */
  cypher: string | ((params: Params) => string)
  /** Defaults to the scenario parameters, with numbers sent as integers. */
  params?: (params: Params) => Record<string, unknown>
}

export function integerParams(params: Params): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? int(value) : value]),
  )
}

export async function runCypher(cypher: string, params: Record<string, unknown>, timeoutMs: number) {
  return neo4jDriver().executeQuery(cypher, params, {
    database: config.NEO4J_DATABASE,
    routing: neo4j.routing.READ,
    transactionConfig: { timeout: timeoutMs },
  })
}

function describe(plan: ProfiledPlan, depth = 0): string[] {
  const details = String(plan.arguments.Details ?? '')
  const line = `${'  '.repeat(depth)}${plan.operatorType.replace(/@.*/, '')}  rows=${plan.rows}  dbHits=${plan.dbHits}  ${details}`
  return [line.trimEnd(), ...plan.children.flatMap((child) => describe(child, depth + 1))]
}

const totalDbHits = (plan: ProfiledPlan): number =>
  plan.dbHits + plan.children.reduce((sum, child) => sum + totalDbHits(child), 0)

export async function profileCypher(
  cypher: string,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<ExplainResponse> {
  const result = await runCypher(`PROFILE ${cypher}`, params, timeoutMs)
  const profile = result.summary.profile
  if (!profile) throw new Error('Neo4j returned no profile')
  const lines = describe(profile)
  return {
    engine: 'neo4j',
    metrics: [
      { label: 'Total db hits', value: totalDbHits(profile).toLocaleString('en-US') },
      { label: 'Rows returned', value: String(result.records.length) },
      { label: 'Operators', value: String(lines.length) },
    ],
    plan: lines.join('\n'),
  }
}

export function neo4jEngine(spec: Neo4jSpec): EngineQuery {
  const text = (params: Params) => (typeof spec.cypher === 'function' ? spec.cypher(params) : spec.cypher).trim()
  const bind = spec.params ?? integerParams

  return {
    engine: 'neo4j',
    label: spec.label,
    language: 'cypher',
    notes: spec.notes,
    query: (params) => {
      const shown = Object.entries(params).map(([key, value]) => `$${key} = ${value}`)
      return shown.length ? `// ${shown.join(', ')}\n${text(params)}` : text(params)
    },
    run: async (params, timeoutMs) => {
      const result = await runCypher(text(params), bind(params), timeoutMs)
      return result.records.map((record) => record.toObject())
    },
    explain: (params, timeoutMs) => profileCypher(text(params), bind(params), timeoutMs),
  }
}
