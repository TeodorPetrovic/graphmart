import { createError } from 'h3'
import { z } from 'zod'
import { Tracer } from '../../../../infrastructure/trace'
import { createReview, ReviewFailure } from '../../../../modules/catalog/reviews.service'
import { intParam, validBody } from '../../../../utils/http'

const reviewSchema = z.object({
  userId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(5000),
})

export default defineEventHandler(async (event) => {
  const productId = intParam(event, 'id')
  const input = await validBody(event, reviewSchema)
  const tracer = new Tracer()
  try {
    return { ...(await createReview(productId, input, tracer)), trace: tracer.entries }
  } catch (error) {
    if (error instanceof ReviewFailure) {
      throw createError({
        statusCode: error.code,
        statusMessage: error.message,
        message: error.message,
        data: { trace: tracer.entries },
      })
    }
    throw error
  }
})
