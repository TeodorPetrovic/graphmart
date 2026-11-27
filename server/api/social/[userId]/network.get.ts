import { z } from 'zod'
import { network } from '../../../modules/social/service'
import { intParam, validQuery } from '../../../utils/http'
import { Tracer } from '../../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(
    event,
    z.object({
      depth: z.coerce.number().int().min(1).max(3).default(2),
      limit: z.coerce.number().int().min(1).max(100).default(60),
    }),
  )
  return network(intParam(event, 'userId'), q.depth, q.limit, new Tracer())
})
