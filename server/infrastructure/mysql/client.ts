import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise'
import { config } from '../config'

let pool: Pool | null = null

export function mysqlPool(): Pool {
  pool ??= mysql.createPool({
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    database: config.MYSQL_DATABASE,
    connectionLimit: 8,
    connectTimeout: 4000,
    decimalNumbers: true,
    timezone: 'Z',
  })
  return pool
}

/** Text protocol query with `?` placeholders. */
export async function sqlQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await mysqlPool().query<RowDataPacket[]>(sql, params)
  return rows as T[]
}

export async function closeMysql(): Promise<void> {
  await pool?.end()
  pool = null
}
