import { z } from 'zod'
import { route } from '../../modules/logistics/service'
import { validQuery } from '../../utils/http'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(
    event,
    z.object({
      from: z.coerce.number().int().positive(),
      to: z.coerce.number().int().positive(),
      metric: z.enum(['distance', 'duration', 'hops']).default('distance'),
    }),
  )
  return route(q.from, q.to, q.metric, new Tracer())
})
