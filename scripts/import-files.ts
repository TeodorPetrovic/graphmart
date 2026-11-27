/**
 * `bun run db:import`: loads the files in `database/` into the databases set in `.env`.
 * Options: --replace (delete what is already there), --only mongo,mysql,neo4j
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BSON, type Document } from 'mongodb'
import { closeMongo, mongoDb } from '../server/infrastructure/mongo/client'
import { ensureMongoSchema } from '../server/infrastructure/mongo/schema'
import { closeMysql, mysqlPool } from '../server/infrastructure/mysql/client'
import { closeNeo4j, writeCypher } from '../server/infrastructure/neo4j/client'
import { files, MONGO_COLLECTIONS, statements, type DatasetInfo } from './lib/files'
import { assertSafeToLoad, ENGINES, parseEngines, type Engine } from './lib/targets'
import { clearGraph } from './seed/loaders/neo4j'

const read = (path: string) => readFileSync(path, 'utf8')

async function importMongo(): Promise<void> {
  const db = mongoDb()
  await db.dropDatabase()
  await ensureMongoSchema(db)
  for (const name of MONGO_COLLECTIONS) {
    const documents = BSON.EJSON.parse(read(files.mongoCollection(name))) as Document[]
    for (let offset = 0; offset < documents.length; offset += 1000) {
      await db.collection(name).insertMany(documents.slice(offset, offset + 1000))
    }
  }
}

async function importMysql(): Promise<void> {
  const connection = await mysqlPool().getConnection()
  try {
    // The file names its own database for use by hand; here the one in .env is used.
    const script = statements(read(files.mysql)).filter((statement) => !/^(CREATE DATABASE|USE )/i.test(statement))
    for (const statement of script) await connection.query(statement)
  } finally {
    connection.release()
  }
}

async function importNeo4j(): Promise<void> {
  await clearGraph()
  for (const statement of statements(read(files.neo4j))) await writeCypher(statement)
}

const IMPORTERS: Record<Engine, { name: string; run: () => Promise<void> }> = {
  mongo: { name: 'MongoDB', run: importMongo },
  mysql: { name: 'MySQL', run: importMysql },
  neo4j: { name: 'Neo4j', run: importNeo4j },
}

function options() {
  const args = process.argv.slice(2)
  const only = args.indexOf('--only')
  const unknown = args.filter((arg, i) => arg !== '--replace' && arg !== '--only' && i !== only + 1)
  if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(' ')}`)
  return {
    replace: args.includes('--replace'),
    engines: only < 0 ? new Set<Engine>(ENGINES) : parseEngines(args[only + 1] ?? ''),
  }
}

try {
  const { engines, replace } = options()
  await assertSafeToLoad(engines, replace)
  const info = JSON.parse(read(files.info)) as DatasetInfo
  console.log(`Importing the ${info.scale} dataset`)
  for (const engine of engines) {
    const started = performance.now()
    await IMPORTERS[engine].run()
    console.log(`  ${IMPORTERS[engine].name}: ${((performance.now() - started) / 1000).toFixed(1)} s`)
  }
  // The benchmark records which dataset it measured.
  mkdirSync(new URL('../.data', import.meta.url), { recursive: true })
  writeFileSync(new URL('../.data/seed-info.json', import.meta.url), JSON.stringify(info, null, 2))
  console.log('Done.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await Promise.allSettled([closeMongo(), closeMysql(), closeNeo4j()])
}
