import { z } from 'zod'
import { rings } from '../../modules/fraud/service'
import { validQuery } from '../../utils/http'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(
    event,
    z.object({
      minUsers: z.coerce.number().int().min(2).max(100).default(3),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  )
  return rings(q.minUsers, q.limit, new Tracer())
})
