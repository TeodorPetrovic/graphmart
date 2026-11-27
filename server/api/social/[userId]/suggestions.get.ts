import { z } from 'zod'
import { suggestions } from '../../../modules/social/service'
import { intParam, validQuery } from '../../../utils/http'
import { Tracer } from '../../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(event, z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }))
  return suggestions(intParam(event, 'userId'), q.limit, new Tracer())
})
