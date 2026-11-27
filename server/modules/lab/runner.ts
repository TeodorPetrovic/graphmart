import type {
  EngineId,
  EngineRunResult,
  ExplainResponse,
  Row,
  RunScenarioRequest,
  RunScenarioResponse,
} from '../../../shared/types/api'
import { round } from '../../infrastructure/trace'
import { LabError } from './errors'
import { validateParams } from './params'
import { findScenario } from './registry'
import { normaliseRow, rowsMatch } from './rows'
import type { EngineQuery, Params } from './types'

export const TIMEOUT_MS = 15_000
const DEFAULT_ITERATIONS = 5
const VISIBLE_ROWS = 50

interface Measurement {
  result: EngineRunResult
  /** All rows, for comparing engines; null when the engine failed. */
  rows: Row[] | null
}

/** Nearest rank percentile of an ascending list. */
export function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}

/** MySQL error 3024, MongoDB MaxTimeMSExpired and Neo4j transaction timeouts. */
function isTimeout(message: string): boolean {
  return /maximum statement execution time|exceeded time limit|MaxTimeMSExpired|timed? ?out/i.test(message)
}

async function measure(engine: EngineQuery, params: Params, iterations: number): Promise<Measurement> {
  const durations: number[] = []
  try {
    // One unmeasured run so every engine is compared with a warm cache.
    let rows = await engine.run(params, TIMEOUT_MS)
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      rows = await engine.run(params, TIMEOUT_MS)
      durations.push(performance.now() - start)
    }
    durations.sort((a, b) => a - b)
    const normalised = rows.map(normaliseRow)
    return {
      rows: normalised,
      result: {
        engine: engine.engine,
        ok: true,
        error: null,
        timedOut: false,
        iterations: durations.length,
        minMs: round(durations[0] ?? 0),
        medianMs: round(percentile(durations, 0.5)),
        p95Ms: round(percentile(durations, 0.95)),
        rowCount: normalised.length,
        rows: normalised.slice(0, VISIBLE_ROWS),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      rows: null,
      result: {
        engine: engine.engine,
        ok: false,
        error: message,
        timedOut: isTimeout(message),
        iterations: durations.length,
        minMs: null,
        medianMs: null,
        p95Ms: null,
        rowCount: 0,
        rows: [],
      },
    }
  }
}

function selectEngines(engines: EngineQuery[], requested?: EngineId[]): EngineQuery[] {
  if (!requested?.length) return engines
  const missing = requested.find((id) => !engines.some((engine) => engine.engine === id))
  if (missing) throw new LabError(400, `This scenario has no ${missing} query`)
  return engines.filter((engine) => requested.includes(engine.engine))
}

export async function runScenario(id: string, request: RunScenarioRequest = {}): Promise<RunScenarioResponse> {
  const scenario = findScenario(id)
  const params = validateParams(scenario.params, request.params)
  const measurements: Measurement[] = []
  // Sequential on purpose: engines running at the same time would compete for CPU and disk.
  for (const engine of selectEngines(scenario.engines, request.engines)) {
    measurements.push(await measure(engine, params, request.iterations ?? DEFAULT_ITERATIONS))
  }
  const comparable = measurements.flatMap((measurement) => (measurement.rows ? [measurement.rows] : []))
  return {
    scenarioId: id,
    params,
    results: measurements.map((measurement) => measurement.result),
    resultsMatch: comparable.length < 2 ? null : rowsMatch(comparable),
  }
}

export async function explainScenario(id: string, engineId: EngineId, input?: Params): Promise<ExplainResponse> {
  const scenario = findScenario(id)
  const params = validateParams(scenario.params, input)
  const [engine] = selectEngines(scenario.engines, [engineId])
  return engine!.explain(params, TIMEOUT_MS)
}
