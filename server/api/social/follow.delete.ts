import { createError } from 'h3'
import { z } from 'zod'
import { Tracer } from '../../infrastructure/trace'
import { follow } from '../../modules/social/service'
import { validBody } from '../../utils/http'

const followRequest = z.object({
  followerId: z.number().int().positive(),
  followeeId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const body = await validBody(event, followRequest)
  if (body.followerId === body.followeeId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request', message: 'Cannot unfollow yourself' })
  }

  try {
    return await follow(body.followerId, body.followeeId, false, new Tracer())
  } catch (error) {
    if (error instanceof Error && error.message === 'Unknown user') {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Unknown user' })
    }
    throw error
  }
})
