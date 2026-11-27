import { z } from 'zod'
import { recommend } from '../../modules/recommendations/service'
import { intParam, validQuery } from '../../utils/http'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(
    event,
    z.object({
      strategy: z.enum(['collaborative', 'social', 'category']).default('collaborative'),
      limit: z.coerce.number().int().min(1).max(40).default(12),
    }),
  )
  return recommend(intParam(event, 'userId'), q.strategy, q.limit, new Tracer())
})
