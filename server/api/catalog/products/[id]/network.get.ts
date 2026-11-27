import { z } from 'zod'
import { productNetwork } from '../../../../modules/social-proof/service'
import { Tracer } from '../../../../infrastructure/trace'
import { intParam, notFound, validQuery } from '../../../../utils/http'
import { int, readCypher } from '../../../../infrastructure/neo4j/client'

export default defineEventHandler(async (event) => {
  const productId = intParam(event, 'id')
  const query = validQuery(event, z.object({ userId: z.coerce.number().int().positive() }))
  const tracer = new Tracer()
  const exists = await readCypher<{ id: number }>(
    'MATCH (product:Product {id:$productId}) RETURN product.id AS id',
    { productId: int(productId) },
    { tracer, operation: 'Check product for social proof' },
  )
  if (!exists.length) throw notFound('Product not found')
  return productNetwork(productId, query.userId, tracer)
})
