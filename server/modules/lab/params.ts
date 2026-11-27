import type { ScenarioParamSpec } from '../../../shared/types/api'
import { LabError } from './errors'
import type { Params } from './types'

/**
 * Applies defaults and enforces the declared type and range. Numbers are always integers,
 * which also makes it safe to interpolate them as Cypher variable length bounds.
 */
export function validateParams(specs: ScenarioParamSpec[], input: Params = {}): Params {
  const unknown = Object.keys(input).find((key) => !specs.some((spec) => spec.name === key))
  if (unknown) throw new LabError(400, `Unknown parameter: ${unknown}`)

  return Object.fromEntries(
    specs.map((spec) => {
      const value = input[spec.name] ?? spec.default
      if (typeof value !== spec.type) throw new LabError(400, `${spec.name} must be a ${spec.type}`)
      if (typeof value === 'number') {
        const min = spec.min ?? 0
        const max = spec.max ?? Number.MAX_SAFE_INTEGER
        if (!Number.isInteger(value) || value < min || value > max) {
          throw new LabError(400, `${spec.name} must be an integer from ${min} to ${max}`)
        }
      }
      return [spec.name, value]
    }),
  )
}
