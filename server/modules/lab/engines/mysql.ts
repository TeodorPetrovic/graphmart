import type { RowDataPacket } from 'mysql2/promise'
import type { ExplainResponse } from '../../../../shared/types/api'
import { mysqlPool } from '../../../infrastructure/mysql/client'
import type { EngineQuery, Params } from '../types'
import { parseMysqlPlan } from './mysql-plan'

export interface MysqlSpec {
  label: string
  notes: string[]
  /** Use `?` placeholders. A function is only needed when the statement shape depends on a parameter. */
  sql: string | ((params: Params) => string)
  /** Placeholder values in order of appearance. */
  values?: (params: Params) => (number | string)[]
}

async function query(statement: string, values: unknown[], timeoutMs: number): Promise<RowDataPacket[]> {
  const connection = await mysqlPool().getConnection()
  try {
    // The server aborts the SELECT itself, so a slow query cannot keep running after we give up.
    await connection.query('SET SESSION max_execution_time = ?', [timeoutMs])
    const [rows] = await connection.query<RowDataPacket[]>(statement, values)
    return rows
  } finally {
    connection.release()
  }
}

export function mysqlEngine(spec: MysqlSpec): EngineQuery {
  const text = (params: Params) => (typeof spec.sql === 'function' ? spec.sql(params) : spec.sql).trim()
  const values = (params: Params) => spec.values?.(params) ?? []

  return {
    engine: 'mysql',
    label: spec.label,
    language: 'sql',
    notes: spec.notes,
    query: (params) => {
      const bound = values(params)
      return bound.length ? `-- ? = ${bound.join(', ')}\n${text(params)}` : text(params)
    },
    run: (params, timeoutMs) => query(text(params), values(params), timeoutMs),
    explain: async (params, timeoutMs): Promise<ExplainResponse> => {
      const rows = await query(`EXPLAIN ANALYZE ${text(params)}`, values(params), timeoutMs)
      const plan = rows.map((row) => String(row.EXPLAIN)).join('\n')
      return { engine: 'mysql', metrics: parseMysqlPlan(plan), plan }
    },
  }
}
