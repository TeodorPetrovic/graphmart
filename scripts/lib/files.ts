/** Layout of the database files, shared by `db:export` and `db:import`. */
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../../database')

export const files = {
  info: resolve(root, 'dataset.json'),
  mysql: resolve(root, 'mysql/graphmart.sql'),
  /** A gzipped `mongodump` archive of the whole database. */
  mongo: resolve(root, 'mongodb/graphmart.agz'),
  neo4j: resolve(root, 'neo4j/graphmart.cypher'),
}

export interface DatasetInfo {
  scale: string
  generatedAt: string
  counts: Record<string, number>
}

/**
 * SQL and Cypher files hold one statement per line group, each ending with ";" at the end of a
 * line. Line breaks inside text values are always written escaped, so this split is exact.
 */
export function statements(script: string): string[] {
  return script
    .replace(/^(--|\/\/).*$/gm, '')
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}
