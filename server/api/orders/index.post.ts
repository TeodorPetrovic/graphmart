import { createError } from 'h3'
import { z } from 'zod'
import { Tracer } from '../../infrastructure/trace'
import { createOrder, OrderFailure } from '../../modules/orders/orders.service'
import { validBody } from '../../utils/http'

const orderSchema = z.object({
  userId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  paymentMethod: z.enum(['card', 'paypal', 'cash_on_delivery']),
  cardFingerprint: z.string().nullable().optional(),
  deviceId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const input = await validBody(event, orderSchema)
  const tracer = new Tracer()
  try {
    const result = await createOrder(input, tracer)
    const order = result.order
    return {
      order: {
        id: order._id,
        userId: order.userId,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        totalCents: order.totalCents,
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
        })),
      },
      eventId: result.eventId,
      trace: tracer.entries,
    }
  } catch (error) {
    if (error instanceof OrderFailure) {
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
