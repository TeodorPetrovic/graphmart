/** `bun run db:check`: can the app reach each database, and what is in it? */
import { closeMongo } from '../server/infrastructure/mongo/client'
import { closeMysql } from '../server/infrastructure/mysql/client'
import { closeNeo4j } from '../server/infrastructure/neo4j/client'
import { ENGINES, targetState } from './lib/targets'

try {
  for (const engine of ENGINES) {
    try {
      const state = await targetState(engine)
      console.log(`OK   ${state.name} ${state.version}: ${state.records.toLocaleString('en')} records`)
      console.log(`     ${state.address}`)
      if (state.note) console.log(`     ${state.note}`)
    } catch (error) {
      process.exitCode = 1
      console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`)
    }
  }
} finally {
  await Promise.allSettled([closeMongo(), closeMysql(), closeNeo4j()])
}
