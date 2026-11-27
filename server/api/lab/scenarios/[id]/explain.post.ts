import { z } from 'zod'
import { explainScenario } from '../../../../modules/lab/runner'
import { validBody } from '../../../../utils/http'
import { labParams, labRequest } from '../../../../utils/lab'

const body = z.object({ engine: z.enum(['mysql', 'mongo', 'neo4j']), params: labParams.optional() })

export default defineEventHandler(async (event) => {
  const { engine, params } = await validBody(event, body)
  return labRequest(() => explainScenario(getRouterParam(event, 'id') ?? '', engine, params))
})
