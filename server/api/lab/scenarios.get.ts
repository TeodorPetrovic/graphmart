import { describeScenario, scenarios } from '../../modules/lab/registry'
import type { ScenarioListResponse } from '../../../shared/types/api'

export default defineEventHandler((): ScenarioListResponse => ({ scenarios: scenarios.map(describeScenario) }))
