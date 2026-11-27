import { z } from 'zod'
import { Tracer } from '../../../infrastructure/trace'
import { userOrders } from '../../../modules/users/users.repository'
import { intParam, validQuery } from '../../../utils/http'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export default defineEventHandler(async (event) => {
  const id = intParam(event, 'id')
  const query = validQuery(event, querySchema)
  const tracer = new Tracer()
  const documents = await userOrders(id, query.limit, tracer)
  const orders = documents.map((order) => ({
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
  }))
  return { orders, trace: tracer.entries }
})
