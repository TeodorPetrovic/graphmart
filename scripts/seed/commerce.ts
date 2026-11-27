import type { Address, OrderDoc, ProductDoc, ProductViewDoc, ReviewDoc, UserDoc } from '../../shared/types/domain'
import { productFamily } from './catalog'
import { dateAfter, pick, type RandomSource } from './random'

export interface CommerceData {
  orders: OrderDoc[]
  reviews: ReviewDoc[]
  views: ProductViewDoc[]
}

export function generateCommerce(
  sizes: { orders: number; reviews: number; views: number },
  users: UserDoc[],
  addresses: Map<number, Address[]>,
  products: ProductDoc[],
  random: RandomSource,
): CommerceData {
  const productById = new Map(products.map((product) => [product._id, product]))
  const productsByFamily = groupProducts(products)
  const orders = generateOrders(sizes.orders, users, addresses, productById, productsByFamily, random)
  const boughtProducts = collectBoughtProducts(orders)
  const reviews = generateReviews(sizes.reviews, users, products, productById, productsByFamily, boughtProducts, random)
  const views = generateViews(sizes.views, users, products, productsByFamily, boughtProducts, random)
  updateRatingSummaries(products, reviews)
  return { orders, reviews, views }
}

function generateOrders(
  count: number,
  users: UserDoc[],
  addresses: Map<number, Address[]>,
  productById: Map<number, ProductDoc>,
  productsByFamily: Map<string, ProductDoc[]>,
  random: RandomSource,
): OrderDoc[] {
  const orders: OrderDoc[] = []

  for (let id = 1; id <= count; id += 1) {
    const userId = specialOrderUser(id, users.length, random)
    const user = users[userId - 1]!
    const itemCount = 1 + Math.floor(random.next() * 4)
    const productIds = new Set<number>()
    if (userId === 1 && id <= 12) productIds.add(1)
    while (productIds.size < itemCount)
      productIds.add(sampleForUser(user, productsByFamily, productById.size, random)._id)
    const items = [...productIds].map((productId) => {
      const product = productById.get(productId)!
      return {
        productId,
        name: product.name,
        categoryId: product.categoryId,
        unitPriceCents: product.priceCents,
        quantity: 1 + Math.floor(random.next() * 3),
      }
    })
    const method = id >= 19 && id <= 24 ? 'card' : pick(random, ['card', 'paypal', 'cash_on_delivery'] as const)
    const status =
      id >= 19 && id <= 24
        ? 'paid'
        : random.next() < 0.025
          ? 'cancelled'
          : pick(random, ['paid', 'shipped', 'delivered'] as const)
    const shippingAddress =
      userId >= 101 && userId <= 106 ? addresses.get(userId)![0]! : pick(random, addresses.get(userId)!)

    orders.push({
      _id: id,
      userId,
      status,
      createdAt: dateAfter(random, user.createdAt),
      items,
      totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
      payment: { method, cardFingerprint: method === 'card' ? ringCard(userId, random) : null },
      deviceId: deviceForUser(userId, random),
      shippingAddress,
    })
  }

  return orders
}

function specialOrderUser(orderId: number, userCount: number, random: RandomSource): number {
  if (orderId <= 12) return 1
  if (orderId === 13) return Math.min(201, userCount)
  if (orderId === 14) return Math.min(202, userCount)
  if (orderId >= 19 && orderId <= 24) return 101 + orderId - 19
  return 1 + Math.floor(random.next() * userCount)
}

function generateReviews(
  count: number,
  users: UserDoc[],
  products: ProductDoc[],
  productById: Map<number, ProductDoc>,
  productsByFamily: Map<string, ProductDoc[]>,
  boughtProducts: Map<number, Set<number>>,
  random: RandomSource,
): ReviewDoc[] {
  const reviews: ReviewDoc[] = []
  const reviewed = new Set<string>()

  for (let id = 1; id <= count; id += 1) {
    const userId = id <= 30 ? 1 : 1 + Math.floor(random.next() * users.length)
    const user = users[userId - 1]!
    const bought = [...(boughtProducts.get(userId) ?? [])]
    let product = id <= products.length ? productById.get(id)! : undefined
    if (random.next() < 0.8 && bought.length) product = productById.get(pick(random, bought))
    product ??= sampleForUser(user, productsByFamily, productById.size, random)

    let attempts = 0
    while (reviewed.has(`${userId}:${product._id}`) && attempts < 20) {
      product = sampleForUser(user, productsByFamily, productById.size, random)
      attempts += 1
    }
    if (reviewed.has(`${userId}:${product._id}`)) {
      product = products.find((candidate) => !reviewed.has(`${userId}:${candidate._id}`))!
    }
    reviewed.add(`${userId}:${product._id}`)
    const rating = random.next() < 0.8 ? 4 + Math.floor(random.next() * 2) : 2 + Math.floor(random.next() * 2)
    const userProduct = users[userId - 1]!

    reviews.push({
      _id: id,
      productId: product._id,
      userId,
      userName: userProduct.name,
      rating,
      title: pick(random, [
        'A lovely upgrade',
        'Great value',
        'Just what I needed',
        'Solid everyday choice',
        'Impressive quality',
      ]),
      body: `${pick(random, ['Works beautifully', 'Easy to set up', 'Feels well made', 'A reliable purchase'])} and arrived sooner than expected.`,
      helpfulVotes: Math.floor(random.next() * 80),
      createdAt: dateAfter(random, user.createdAt),
    })
  }
  return reviews
}

function generateViews(
  count: number,
  users: UserDoc[],
  products: ProductDoc[],
  productsByFamily: Map<string, ProductDoc[]>,
  boughtProducts: Map<number, Set<number>>,
  random: RandomSource,
): ProductViewDoc[] {
  const views: ProductViewDoc[] = []
  for (let id = 1; id <= count; id += 1) {
    const userId = id <= 40 ? 1 : 1 + Math.floor(random.next() * users.length)
    const user = users[userId - 1]!
    const bought = [...(boughtProducts.get(userId) ?? [])]
    const viewedProduct =
      id <= 60
        ? products[0]!
        : random.next() < 0.65 && bought.length
          ? products[bought[Math.floor(random.next() * bought.length)] - 1]!
          : sampleForUser(user, productsByFamily, products.length, random)
    views.push({ ts: dateAfter(random, user.createdAt), meta: { userId, productId: viewedProduct._id } })
  }
  return views
}

function sampleForUser(
  user: UserDoc,
  productsByFamily: Map<string, ProductDoc[]>,
  productCount: number,
  random: RandomSource,
): ProductDoc {
  // A small head-item bias keeps product 1 visibly popular while most choices stay interest-led.
  if (random.next() < 0.035) return productsByFamily.get('all')![0]!
  const favoredProducts = getFavoredProducts(user, productsByFamily)
  if (favoredProducts.length && random.next() < 0.78) return zipfPick(favoredProducts, random)
  return zipfPick(productsByFamily.get('all')!, random, productCount)
}

const cumulativeZipfWeights = new WeakMap<ProductDoc[], number[]>()
const favoredProductsByUser = new WeakMap<UserDoc, ProductDoc[]>()

function getFavoredProducts(user: UserDoc, productsByFamily: Map<string, ProductDoc[]>): ProductDoc[] {
  let products = favoredProductsByUser.get(user)
  if (!products) {
    products = user.interests.flatMap((interest) => productsByFamily.get(interest) ?? [])
    favoredProductsByUser.set(user, products)
  }
  return products
}

function zipfPick(products: ProductDoc[], random: RandomSource, limit = products.length): ProductDoc {
  let cumulative = cumulativeZipfWeights.get(products)
  if (!cumulative) {
    cumulative = []
    let total = 0
    for (let rank = 1; rank <= products.length; rank += 1) {
      total += 1 / Math.pow(rank, 0.8)
      cumulative.push(total)
    }
    cumulativeZipfWeights.set(products, cumulative)
  }
  const target = random.next() * cumulative[Math.min(limit, cumulative.length) - 1]!
  let low = 0
  let high = Math.min(limit, cumulative.length) - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (cumulative[middle]! < target) low = middle + 1
    else high = middle
  }
  return products[low]!
}

function groupProducts(products: ProductDoc[]): Map<string, ProductDoc[]> {
  const grouped = new Map<string, ProductDoc[]>()
  for (const product of products) {
    const family = productFamily(product)
    const familyProducts = grouped.get(family) ?? []
    familyProducts.push(product)
    grouped.set(family, familyProducts)
  }
  grouped.set('all', products)
  return grouped
}

function collectBoughtProducts(orders: OrderDoc[]): Map<number, Set<number>> {
  const bought = new Map<number, Set<number>>()
  for (const order of orders) {
    const products = bought.get(order.userId) ?? new Set<number>()
    for (const item of order.items) products.add(item.productId)
    bought.set(order.userId, products)
  }
  return bought
}

function updateRatingSummaries(products: ProductDoc[], reviews: ReviewDoc[]): void {
  for (const review of reviews) {
    const summary = products[review.productId - 1]!.ratingSummary
    summary.count += 1
    summary.sum += review.rating
  }
  for (const product of products) {
    const summary = product.ratingSummary
    summary.avg = summary.count ? Math.round((summary.sum / summary.count) * 100) / 100 : 0
  }
}

function deviceForUser(userId: number, random: RandomSource): string {
  if (userId >= 101 && userId <= 106) return 'device-ring-01'
  if (userId % 500 === 201 || userId % 500 === 202) return `device-household-${Math.floor((userId - 1) / 500)}`
  return `device-${userId}-${Math.floor(random.next() * 3)}`
}

function ringCard(userId: number, random: RandomSource): string {
  if (userId >= 101 && userId <= 106) return 'card-ring-shared'
  return `card-${userId}-${Math.floor(random.next() * 2)}`
}
