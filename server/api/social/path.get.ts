import { z } from 'zod'
import { shortestPaths } from '../../modules/social/service'
import { validQuery } from '../../utils/http'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(
    event,
    z.object({
      from: z.coerce.number().int().positive(),
      to: z.coerce.number().int().positive(),
      maxDepth: z.coerce.number().int().min(1).max(8).default(6),
    }),
  )
  return shortestPaths(q.from, q.to, q.maxDepth, new Tracer())
})
