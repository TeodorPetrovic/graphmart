import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { closeMongo } from '../server/infrastructure/mongo/client'
import { closeMysql } from '../server/infrastructure/mysql/client'
import { closeNeo4j } from '../server/infrastructure/neo4j/client'
import type { ScaleName } from '../shared/utils/demo'
import { generateDataset, type Dataset } from './seed/generate'
import { loadMongo } from './seed/loaders/mongo'
import { loadMysql } from './seed/loaders/mysql'
import { loadNeo4j } from './seed/loaders/neo4j'

const seedInfoPath = resolve(import.meta.dir, '../.data/seed-info.json')
const seedStartedAt = performance.now()
const timings: Record<string, number> = {}

function parseArgs(): { scale: ScaleName; engines: Set<string> } {
  let scale: ScaleName = 'medium'
  const engines = new Set(['mongo', 'mysql', 'neo4j'])

  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index]!
    if (argument === '--scale') {
      const requestedScale = process.argv[++index]
      if (requestedScale !== 'small' && requestedScale !== 'medium' && requestedScale !== 'large') {
        throw new Error('--scale must be small, medium or large')
      }
      scale = requestedScale
      continue
    }
    if (argument === '--only') {
      const engineList = process.argv[++index]
      if (!engineList) throw new Error('--only requires a comma separated engine list')
      engines.clear()
      for (const engine of engineList.split(',')) {
        if (!['mongo', 'mysql', 'neo4j'].includes(engine)) throw new Error(`Unknown engine: ${engine}`)
        engines.add(engine)
      }
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  return { scale, engines }
}

async function timed<T>(step: string, work: () => Promise<T>): Promise<T> {
  const startedAt = performance.now()
  const result = await work()
  const seconds = Math.round((performance.now() - startedAt) / 10) / 100
  timings[step] = seconds
  console.log(`${step}: ${seconds}s`)
  return result
}

async function main(): Promise<void> {
  if (existsSync(seedInfoPath)) rmSync(seedInfoPath)
  mkdirSync(resolve(import.meta.dir, '../.data'), { recursive: true })
  const { scale, engines } = parseArgs()
  const dataset = await timed('Generate dataset', async () => generateDataset(scale))

  if (engines.has('mongo')) await timed('MongoDB load', () => loadMongo(dataset))
  if (engines.has('mysql')) await timed('MySQL load', () => loadMysql(dataset))
  if (engines.has('neo4j')) await timed('Neo4j load', () => loadNeo4j(dataset))
  writeSeedInfo(scale, dataset)
}

function writeSeedInfo(scale: ScaleName, dataset: Dataset): void {
  const counts = {
    users: dataset.users.length,
    categories: dataset.categories.length,
    products: dataset.products.length,
    orders: dataset.orders.length,
    reviews: dataset.reviews.length,
    views: dataset.views.length,
    follows: dataset.follows.length,
    warehouses: dataset.warehouses.length,
    routes: dataset.routes.length,
  }
  const durationSeconds = Math.round((performance.now() - seedStartedAt) / 100) / 10
  console.log(`Seed complete (${durationSeconds}s)`)
  writeFileSync(
    seedInfoPath,
    JSON.stringify({ scale, generatedAt: new Date().toISOString(), counts, durationSeconds, timings }, null, 2),
  )
}

try {
  await main()
} finally {
  await Promise.allSettled([closeMongo(), closeMysql(), closeNeo4j()])
}
