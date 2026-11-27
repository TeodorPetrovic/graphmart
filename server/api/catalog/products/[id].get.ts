import { z } from 'zod'
import { Tracer } from '../../../infrastructure/trace'
import { productDetail, recordProductView } from '../../../modules/catalog/catalog.repository'
import { alsoBought } from '../../../modules/recommendations/also-bought'
import { intParam, notFound, validQuery } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const productId = intParam(event, 'id')
  const query = validQuery(event, z.object({ userId: z.coerce.number().int().positive().optional() }))
  const tracer = new Tracer()
  const result = await productDetail(productId, tracer)
  if (!result) throw notFound('Product not found')

  const recommendations = await alsoBought(productId, 8, tracer).catch(() => [])
  if (query.userId) {
    await recordProductView(query.userId, productId, tracer)
  }

  const product = result.product
  return {
    product: {
      id: product._id,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      priceCents: product.priceCents,
      stock: product.stock,
      rating: product.ratingSummary.avg,
      ratingCount: product.ratingSummary.count,
      sku: product.sku,
      description: product.description,
      attributes: Object.fromEntries(product.attributes.map(({ k, v }) => [k, v])),
      tags: product.tags,
      breadcrumbs: result.ancestors.map(({ _id, name }) => ({ id: _id, name })),
    },
    reviews: result.reviews.map((review) => ({
      id: review._id,
      userId: review.userId,
      userName: review.userName,
      rating: review.rating,
      title: review.title,
      body: review.body,
      helpfulVotes: review.helpfulVotes,
      createdAt: review.createdAt.toISOString(),
    })),
    alsoBought: recommendations,
    trace: tracer.entries,
  }
})
