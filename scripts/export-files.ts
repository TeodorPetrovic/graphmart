/**
 * `bun run db:export`: writes what the configured databases hold into `database/`, so it can be
 * loaded elsewhere with `bun run db:import` or by hand. Seed the dataset you want first.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import mysql from 'mysql2/promise'
import neo4j from 'neo4j-driver'
import { config } from '../server/infrastructure/config'
import { closeNeo4j, readCypher } from '../server/infrastructure/neo4j/client'
import { neo4jSchemaStatements } from '../server/infrastructure/neo4j/schema'
import { files, type DatasetInfo } from './lib/files'

const SQL_ROWS = 500
const GRAPH_ROWS = 500

function save(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  console.log(`  ${path} (${(text.length / 1024 / 1024).toFixed(1)} MB)`)
}

function chunks<T>(rows: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
}

// ---------- MongoDB ----------

/** Needs MongoDB Database Tools. Set MONGODUMP to the program if it is not on the PATH. */
function exportMongo(): void {
  const mongodump = process.env.MONGODUMP ?? Bun.which('mongodump')
  if (!mongodump) throw new Error('mongodump not found. Install MongoDB Database Tools or set MONGODUMP.')
  mkdirSync(dirname(files.mongo), { recursive: true })
  const result = Bun.spawnSync([
    mongodump,
    `--uri=${config.MONGO_URI}`,
    `--db=${config.MONGO_DB}`,
    `--archive=${files.mongo}`,
    '--gzip',
  ])
  if (!result.success) throw new Error(`mongodump failed:\n${result.stderr.toString()}`)
  console.log(`  ${files.mongo}`)
}

// ---------- MySQL ----------

async function exportMysql(): Promise<void> {
  const connection = await mysql.createConnection({
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    database: config.MYSQL_DATABASE,
    dateStrings: true,
    decimalNumbers: true,
  })
  try {
    const schema = readFileSync(new URL('../database/mysql/schema.sql', import.meta.url), 'utf8')
    const tables = [...schema.matchAll(/CREATE TABLE (\w+)/g)].map((match) => match[1]!)
    const out = [
      '-- GraphMart for MySQL 8: creates the database "graphmart", its tables and the data.',
      '-- Running it again replaces these tables.',
      'CREATE DATABASE IF NOT EXISTS graphmart;',
      'USE graphmart;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      ...tables.map((table) => `DROP TABLE IF EXISTS \`${table}\`;`),
      '',
      schema,
    ]
    for (const table of tables) {
      const [rows, fields] = await connection.query<mysql.RowDataPacket[]>('SELECT * FROM ??', [table])
      const columns = fields.map((field) => field.name)
      for (const batch of chunks(rows, SQL_ROWS)) {
        const values = batch.map((row) => columns.map((column) => row[column]))
        out.push(`${mysql.format('INSERT INTO ?? (??) VALUES ?', [table, columns, values])};`)
      }
    }
    out.push('SET FOREIGN_KEY_CHECKS = 1;', ...tables.map((table) => `ANALYZE TABLE \`${table}\`;`))
    save(files.mysql, `${out.join('\n')}\n`)
  } finally {
    await connection.end()
  }
}

// ---------- Neo4j ----------

/** The property that identifies a node of each label. */
const NODE_KEYS: Record<string, string> = {
  User: 'id',
  Product: 'id',
  Category: 'id',
  Brand: 'name',
  Device: 'id',
  Card: 'fingerprint',
  Address: 'key',
  Warehouse: 'id',
}

/** A Cypher literal. JSON string escapes are valid in Cypher. */
function literal(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(literal).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, nested]) => `${key}:${literal(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const unwind = (rows: unknown[]) => `UNWIND [\n${rows.map(literal).join(',\n')}\n] AS row`

async function exportNodes(label: string, key: string): Promise<string[]> {
  const rows = await readCypher<{ props: Record<string, unknown> }>(
    `MATCH (n:${label}) RETURN properties(n) AS props ORDER BY n.${key}`,
  )
  const nodes = rows.map((row) => row.props)
  return chunks(nodes, GRAPH_ROWS).map((batch) => `${unwind(batch)}\nCREATE (n:${label}) SET n = row;`)
}

interface Link {
  from: unknown
  to: unknown
  props: Record<string, unknown>
}

async function exportRelationships(type: string, source: string, target: string): Promise<string[]> {
  const sourceKey = NODE_KEYS[source]!
  const targetKey = NODE_KEYS[target]!
  const found = await readCypher<Link>(
    `MATCH (a:${source})-[r:${type}]->(b:${target})
     RETURN a.${sourceKey} AS from, b.${targetKey} AS to, properties(r) AS props
     ORDER BY from, to, elementId(r)`,
  )
  // Dates and times are written as text and converted back by the statement.
  const temporal = new Set<string>()
  const links = found.map(({ from, to, props }) => ({
    from,
    to,
    props: Object.fromEntries(
      Object.entries(props).map(([name, value]) => {
        if (!neo4j.isDateTime(value as object)) return [name, value]
        temporal.add(name)
        return [name, String(value)]
      }),
    ),
  }))
  const restore = [...temporal].map((name) => `, r.${name} = datetime(row.props.${name})`).join('')
  return chunks(links, GRAPH_ROWS).map(
    (batch) =>
      `${unwind(batch)}\nMATCH (a:${source} {${sourceKey}: row.from}), (b:${target} {${targetKey}: row.to})\n` +
      `CREATE (a)-[r:${type}]->(b) SET r = row.props${restore};`,
  )
}

async function exportNeo4j(): Promise<void> {
  const out = [
    '// GraphMart for Neo4j: constraints, indexes, nodes and relationships.',
    '// Run on an empty database with cypher-shell -f.',
    ...[...neo4jSchemaStatements, 'CALL db.awaitIndexes(300)'].map((statement) => `${statement};`),
  ]
  for (const [label, key] of Object.entries(NODE_KEYS)) out.push(...(await exportNodes(label, key)))
  const shapes = await readCypher<{ type: string; source: string; target: string }>(
    `MATCH (a)-[r]->(b)
     RETURN DISTINCT type(r) AS type, labels(a)[0] AS source, labels(b)[0] AS target
     ORDER BY type, source, target`,
  )
  for (const { type, source, target } of shapes) out.push(...(await exportRelationships(type, source, target)))
  save(files.neo4j, `${out.join('\n')}\n`)
}

try {
  const seed = JSON.parse(readFileSync(new URL('../.data/seed-info.json', import.meta.url), 'utf8')) as DatasetInfo
  console.log(`Exporting the ${seed.scale} dataset`)
  exportMongo()
  await exportMysql()
  await exportNeo4j()
  const info: DatasetInfo = { scale: seed.scale, generatedAt: seed.generatedAt, counts: seed.counts }
  save(files.info, `${JSON.stringify(info, null, 2)}\n`)
} finally {
  await closeNeo4j()
}
