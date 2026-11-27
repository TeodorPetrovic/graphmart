import type { Document } from 'mongodb'
import type { CategoryNode, FacetValue, ProductSearchResponse } from '../../../shared/types/api'
import type { OutboxDoc } from '../../../shared/types/domain'
import { collections } from '../../infrastructure/mongo/client'
import { shell, type Tracer } from '../../infrastructure/trace'
import { toProductSummary } from './product-lookup'

export interface ProductSearchInput {
  q?: string
  categoryId?: number
  brand?: string
  minPrice?: number
  maxPrice?: number
  attrs: { k: string; v: string | number | boolean }[]
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest'
  page: number
  pageSize: number
}

const PRICE_BOUNDARIES = [0, 5000, 15000, 50000, 150000, 5000000]

interface CategoryProductCount {
  _id: number
  count: number
}

export async function categoryTree(tracer: Tracer): Promise<CategoryNode[]> {
  const categoriesQuery = 'db.categories.find({}).sort({depth:1,_id:1})'
  // Each product stores its own category and ancestors, so one unwind counts every subtree.
  const countsPipeline = [{ $unwind: '$categoryPath' }, { $group: { _id: '$categoryPath', count: { $sum: 1 } } }]
  const [categories, productCounts] = await Promise.all([
    tracer.run('mongo', 'Load categories', categoriesQuery, () =>
      collections().categories.find().sort({ depth: 1, _id: 1 }).toArray(),
    ),
    tracer.run('mongo', 'Count products by category subtree', shell('products', 'aggregate', countsPipeline), () =>
      collections().products.aggregate<CategoryProductCount>(countsPipeline).toArray(),
    ),
  ])
  const countByCategory = new Map(productCounts.map(({ _id, count }) => [_id, count]))
  const nodes = new Map<number, CategoryNode>(
    categories.map((category) => [
      category._id,
      {
        id: category._id,
        name: category.name,
        productCount: countByCategory.get(category._id) ?? 0,
        children: [],
      },
    ]),
  )
  const roots: CategoryNode[] = []
  for (const category of categories) {
    const node = nodes.get(category._id)
    if (!node) continue
    if (category.parentId === null) roots.push(node)
    else nodes.get(category.parentId)?.children.push(node)
  }
  return roots
}

export async function productDetail(id: number, tracer: Tracer) {
  const product = await tracer.run('mongo', 'Load product detail', shell('products', 'findOne', { _id: id }), () =>
    collections().products.findOne({ _id: id }),
  )
  if (!product) return null
  const reviewsFilter = { productId: id }
  const categoryFilter = { _id: { $in: product.categoryPath } }
  const [reviews, ancestors] = await Promise.all([
    tracer.run(
      'mongo',
      'Latest product reviews',
      `${shell('reviews', 'find', reviewsFilter)}.sort({createdAt:-1}).limit(10)`,
      () => collections().reviews.find(reviewsFilter).sort({ createdAt: -1 }).limit(10).toArray(),
    ),
    tracer.run(
      'mongo',
      'Load category breadcrumbs',
      `${shell('categories', 'find', categoryFilter)}.sort({depth:1})`,
      () => collections().categories.find(categoryFilter).sort({ depth: 1 }).toArray(),
    ),
  ])
  return { product, reviews, ancestors }
}

export async function recordProductView(userId: number, productId: number, tracer: Tracer): Promise<void> {
  const db = collections()
  const viewedAt = new Date()
  const view = { meta: { userId, productId }, ts: viewedAt }
  await tracer.run('mongo', 'Record product view', shell('product_views', 'insertOne', view), () =>
    db.productViews.insertOne(view),
  )
  const outboxEvent = {
    type: 'product.viewed',
    event: {
      type: 'product.viewed',
      view: { userId, productId, at: viewedAt.toISOString() },
    },
    createdAt: viewedAt,
    processedAt: null,
    attempts: 0,
    error: null,
  } satisfies OutboxDoc
  await tracer.run('mongo', 'Write view outbox event', shell('outbox', 'insertOne', outboxEvent), () =>
    db.outbox.insertOne(outboxEvent),
  )
}

function productSort(input: ProductSearchInput): Record<string, 1 | -1 | { $meta: 'textScore' }> {
  switch (input.sort) {
    case 'price_asc':
      return { priceCents: 1 }
    case 'price_desc':
      return { priceCents: -1 }
    case 'rating':
      return { 'ratingSummary.avg': -1 }
    case 'newest':
      return { createdAt: -1 }
    case 'relevance':
      return input.q ? { score: { $meta: 'textScore' } } : { _id: 1 }
  }
}

function productMatch(input: ProductSearchInput): Document {
  const match: Document = {}
  if (input.q) match.$text = { $search: input.q }
  if (input.categoryId !== undefined) match.categoryPath = input.categoryId
  if (input.brand) match.brand = input.brand
  const price: Document = {}
  if (input.minPrice !== undefined) price.$gte = input.minPrice
  if (input.maxPrice !== undefined) price.$lte = input.maxPrice
  if (Object.keys(price).length > 0) match.priceCents = price
  if (input.attrs.length > 0) {
    match.$and = input.attrs.map(({ k, v }) => ({
      attributes: { $elemMatch: { k, v } },
    }))
  }
  return match
}

function productPipeline(input: ProductSearchInput): Document[] {
  // MongoDB runs the page and all facet summaries over the same matched stream.
  const facets = {
    page: [{ $sort: productSort(input) }, { $skip: (input.page - 1) * input.pageSize }, { $limit: input.pageSize }],
    total: [{ $count: 'count' }],
    brands: [{ $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 20 }],
    priceBuckets: [
      {
        $bucket: {
          groupBy: '$priceCents',
          boundaries: PRICE_BOUNDARIES,
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ],
    attributes: [
      { $unwind: '$attributes' },
      { $group: { _id: { key: '$attributes.k', value: '$attributes.v' }, count: { $sum: 1 } } },
      { $sort: { '_id.key': 1, count: -1, '_id.value': 1 } },
    ],
  }
  return [{ $match: productMatch(input) }, { $facet: facets }]
}

interface ProductFacetRow {
  page: Parameters<typeof toProductSummary>[0][]
  total: { count: number }[]
  brands: { _id: string; count: number }[]
  priceBuckets: { _id: number | string; count: number }[]
  attributes: { _id: { key: string; value: string | number | boolean }; count: number }[]
}

export async function searchProducts(
  input: ProductSearchInput,
  tracer: Tracer,
): Promise<Omit<ProductSearchResponse, 'trace'>> {
  const pipeline = productPipeline(input)
  const result = await tracer.run('mongo', 'Search products and facets', shell('products', 'aggregate', pipeline), () =>
    collections().products.aggregate<ProductFacetRow>(pipeline).next(),
  )
  const row = result ?? { page: [], total: [], brands: [], priceBuckets: [], attributes: [] }
  const attributeGroups = new Map<string, FacetValue[]>()
  for (const attribute of row.attributes) {
    const values = attributeGroups.get(attribute._id.key) ?? []
    values.push({ value: String(attribute._id.value), count: attribute.count })
    attributeGroups.set(attribute._id.key, values)
  }
  const bounds = new Map(PRICE_BOUNDARIES.slice(0, -1).map((min, index) => [min, PRICE_BOUNDARIES[index + 1] ?? null]))
  return {
    items: row.page.map(toProductSummary),
    total: row.total[0]?.count ?? 0,
    page: input.page,
    pageSize: input.pageSize,
    facets: {
      brands: row.brands.map(({ _id, count }) => ({ value: _id, count })),
      priceBuckets: row.priceBuckets.map(({ _id, count }) => ({
        min: typeof _id === 'number' ? _id : 0,
        max: typeof _id === 'number' ? (bounds.get(_id) ?? null) : null,
        count,
      })),
      attributes: [...attributeGroups].map(([key, values]) => ({ key, values })),
    },
  }
}
