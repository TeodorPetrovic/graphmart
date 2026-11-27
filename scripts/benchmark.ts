/**
 * Measures every lab scenario against the three databases.
 *
 *   bun run bench [--iterations 7]
 *
 * Writes `.data/benchmark-report.json` (shown in the app) and `docs/BENCHMARKS.md` (handout).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { parseArgs } from 'node:util'
import { closeMongo } from '../server/infrastructure/mongo/client'
import { closeMysql } from '../server/infrastructure/mysql/client'
import { closeNeo4j } from '../server/infrastructure/neo4j/client'
import { describeScenario, scenarios } from '../server/modules/lab/registry'
import { renderReport, type ScenarioNotes } from '../server/modules/lab/report-markdown'
import { explainScenario, runScenario } from '../server/modules/lab/runner'
import type { BenchmarkReport, ExplainResponse, RunScenarioResponse } from '../shared/types/api'

const { values } = parseArgs({ options: { iterations: { type: 'string', default: '7' } } })
const iterations = Number(values.iterations)
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 30)
  throw new Error('--iterations must be from 1 to 30')

const seed = JSON.parse(await readFile('.data/seed-info.json', 'utf8')) as { scale: string }
const results: RunScenarioResponse[] = []
const scaling: RunScenarioResponse[] = []
const notes: ScenarioNotes[] = []
const problems: string[] = []

function summarise(run: RunScenarioResponse): string {
  const timings = run.results.map(
    (result) => `${result.engine} ${result.ok ? `${result.medianMs} ms` : result.timedOut ? 'TIMEOUT' : 'ERROR'}`,
  )
  return `${run.scenarioId} ${JSON.stringify(run.params)}  ${timings.join(' | ')}  match=${run.resultsMatch}`
}

for (const scenario of scenarios) {
  const run = await runScenario(scenario.id, { iterations })
  results.push(run)
  console.log(summarise(run))
  if (run.resultsMatch === false) problems.push(`${scenario.id}: engines returned different rows`)
  for (const result of run.results) {
    if (!result.ok && !result.timedOut) problems.push(`${scenario.id} ${result.engine}: ${result.error}`)
    if (result.ok && result.rowCount === 0) problems.push(`${scenario.id} ${result.engine}: returned no rows`)
  }

  const explains: ExplainResponse[] = []
  for (const { engine } of scenario.engines) {
    if (run.results.find((result) => result.engine === engine)?.timedOut) continue
    try {
      explains.push(await explainScenario(scenario.id, engine, run.params))
    } catch (error) {
      problems.push(`${scenario.id} ${engine} explain: ${error instanceof Error ? error.message : error}`)
    }
  }
  notes.push({ info: describeScenario(scenario), explains })

  for (const params of scenario.scaling ?? []) {
    const scaled = await runScenario(scenario.id, { params, iterations: 3 })
    scaling.push(scaled)
    console.log(summarise(scaled))
    if (scaled.resultsMatch === false)
      problems.push(`${scenario.id} ${JSON.stringify(params)}: engines returned different rows`)
  }
}

const report: BenchmarkReport = {
  generatedAt: new Date().toISOString(),
  scale: seed.scale,
  machine: `${os.cpus()[0]?.model.trim()}, ${Math.round(os.totalmem() / 1024 ** 3)} GB RAM, ${os.type()}`,
  iterations,
  results,
  scaling,
}
await mkdir('docs', { recursive: true })
await writeFile('.data/benchmark-report.json', `${JSON.stringify(report, null, 2)}\n`)
await writeFile('docs/BENCHMARKS.md', renderReport(report, notes))
await Promise.all([closeMysql(), closeMongo(), closeNeo4j()])

console.log('\nWrote .data/benchmark-report.json and docs/BENCHMARKS.md')
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
