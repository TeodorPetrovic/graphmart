import { z } from 'zod'
import { Tracer } from '../../infrastructure/trace'
import { searchProducts } from '../../modules/catalog/catalog.repository'
import { validQuery } from '../../utils/http'

const querySchema = z.object({
  q: z.string().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  attr: z.union([z.string(), z.array(z.string())]).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
})

function parseAttribute(value: string) {
  const separator = value.indexOf(':')
  const key = separator < 0 ? value : value.slice(0, separator)
  const rawValue = separator < 0 ? '' : value.slice(separator + 1)
  const trimmedValue = rawValue.trim()
  const parsedValue =
    trimmedValue === 'true'
      ? true
      : trimmedValue === 'false'
        ? false
        : trimmedValue !== '' && Number.isFinite(Number(trimmedValue))
          ? Number(trimmedValue)
          : rawValue
  return { k: key, v: parsedValue }
}

export default defineEventHandler(async (event) => {
  const query = validQuery(event, querySchema)
  const attributeParams = Array.isArray(query.attr) ? query.attr : query.attr ? [query.attr] : []
  const attrs = attributeParams.map(parseAttribute)
  const tracer = new Tracer()
  const result = await searchProducts({ ...query, attrs }, tracer)
  return { ...result, trace: tracer.entries }
})
