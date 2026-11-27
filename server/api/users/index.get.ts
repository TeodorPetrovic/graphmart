import { z } from 'zod'
import { Tracer } from '../../infrastructure/trace'
import { searchUsers } from '../../modules/users/users.repository'
import { validQuery } from '../../utils/http'

const searchSchema = z.object({
  q: z.string().default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export default defineEventHandler(async (event) => {
  const query = validQuery(event, searchSchema)
  const tracer = new Tracer()
  const items = await searchUsers(query.q, query.limit, tracer)
  return { items, trace: tracer.entries }
})
