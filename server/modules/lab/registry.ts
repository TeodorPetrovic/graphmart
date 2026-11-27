import type { ScenarioInfo } from '../../../shared/types/api'
import { LabError } from './errors'
import { validateParams } from './params'
import { lectureOne } from './scenarios/lecture-1'
import { lectureTwo } from './scenarios/lecture-2'
import type { Scenario } from './types'

export const scenarios: Scenario[] = [...lectureOne, ...lectureTwo].sort(
  (a, b) => a.lecture - b.lecture || a.order - b.order,
)

export function findScenario(id: string): Scenario {
  const scenario = scenarios.find((candidate) => candidate.id === id)
  if (!scenario) throw new LabError(404, `Unknown lab scenario: ${id}`)
  return scenario
}

/** The serialisable description of a scenario, with query texts for the default parameters. */
export function describeScenario({ engines, scaling: _scaling, ...info }: Scenario): ScenarioInfo {
  const defaults = validateParams(info.params)
  return {
    ...info,
    engines: engines.map((engine) => ({
      engine: engine.engine,
      label: engine.label,
      language: engine.language,
      notes: engine.notes,
      query: engine.query(defaults),
    })),
  }
}
