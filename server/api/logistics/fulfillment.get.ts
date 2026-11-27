import { z } from 'zod'
import { fulfillment } from '../../modules/logistics/service'
import { validQuery } from '../../utils/http'
import { Tracer } from '../../infrastructure/trace'
export default defineEventHandler(async (event) => {
  const q = validQuery(
    event,
    z.object({ productId: z.coerce.number().int().positive(), warehouseId: z.coerce.number().int().positive() }),
  )
  return fulfillment(q.productId, q.warehouseId, new Tracer())
})
