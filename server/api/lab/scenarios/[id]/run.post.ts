import { z } from 'zod'
import { runScenario } from '../../../../modules/lab/runner'
import { validBody } from '../../../../utils/http'
import { labParams, labRequest } from '../../../../utils/lab'

const body = z.object({
  params: labParams.optional(),
  iterations: z.number().int().min(1).max(30).optional(),
  engines: z.array(z.enum(['mysql', 'mongo', 'neo4j'])).optional(),
})

export default defineEventHandler(async (event) => {
  const request = await validBody(event, body)
  return labRequest(() => runScenario(getRouterParam(event, 'id') ?? '', request))
})
