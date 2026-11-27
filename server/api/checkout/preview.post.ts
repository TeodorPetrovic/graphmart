import { createError } from 'h3'
import { z } from 'zod'
import { CheckoutPreviewFailure, previewCheckout } from '../../modules/checkout/service'
import { Tracer } from '../../infrastructure/trace'
import { validBody } from '../../utils/http'

const requestSchema = z.object({
  userId: z.number().int().positive(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
  cardFingerprint: z.string().nullable().optional(),
  deviceId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const input = await validBody(event, requestSchema)
  try {
    return await previewCheckout(input, new Tracer())
  } catch (error) {
    if (error instanceof CheckoutPreviewFailure) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
