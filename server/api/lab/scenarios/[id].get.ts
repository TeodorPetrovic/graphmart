import { describeScenario, findScenario } from '../../../modules/lab/registry'
import { labRequest } from '../../../utils/lab'

export default defineEventHandler((event) =>
  labRequest(async () => describeScenario(findScenario(getRouterParam(event, 'id') ?? ''))),
)
