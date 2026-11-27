import type { EngineId, ExplainResponse, Row, ScenarioEngineInfo, ScenarioInfo } from '../../../shared/types/api'

/** Validated scenario parameters: every spec in `Scenario.params` is present. */
export type Params = Record<string, number | string>

/** One database's answer to a scenario's question. */
export interface EngineQuery {
  engine: EngineId
  label: string
  language: ScenarioEngineInfo['language']
  notes: string[]
  /** The text of exactly what `run` executes for these parameters. */
  query(params: Params): string
  /** Must enforce `timeoutMs` inside the database and return deterministic, flat rows. */
  run(params: Params, timeoutMs: number): Promise<Row[] | Record<string, unknown>[]>
  explain(params: Params, timeoutMs: number): Promise<ExplainResponse>
}

export interface Scenario extends Omit<ScenarioInfo, 'engines'> {
  engines: EngineQuery[]
  /** Extra parameter sets `bun run bench` measures to show how cost grows. */
  scaling?: Params[]
}
