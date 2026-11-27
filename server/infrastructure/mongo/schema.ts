import type { Db, Document, IndexDescription } from 'mongodb'

/** `$jsonSchema` validators: schema flexibility where wanted, guarantees where needed. */
const validators: Record<string, Document> = {
  users: {
    bsonType: 'object',
    required: ['_id', 'name', 'email', 'tier', 'addresses'],
    properties: {
      email: { bsonType: 'string', pattern: '^[^@]+@[^@]+$' },
      tier: { enum: ['bronze', 'silver', 'gold'] },
      addresses: { bsonType: 'array' },
    },
  },
  products: {
    bsonType: 'object',
    required: ['_id', 'sku', 'name', 'priceCents', 'stock', 'categoryPath', 'attributes'],
    properties: {
      priceCents: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      stock: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      attributes: {
        bsonType: 'array',
        items: { bsonType: 'object', required: ['k', 'v'] },
      },
    },
  },
  orders: {
    bsonType: 'object',
    required: ['_id', 'userId', 'status', 'items', 'totalCents', 'createdAt'],
    properties: {
      status: { enum: ['paid', 'shipped', 'delivered', 'cancelled'] },
      items: { bsonType: 'array', minItems: 1 },
    },
  },
  reviews: {
    bsonType: 'object',
    required: ['_id', 'productId', 'userId', 'rating'],
    properties: { rating: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 5 } },
  },
}

const indexes: Record<string, IndexDescription[]> = {
  users: [
    { key: { email: 1 }, unique: true },
    { key: { name: 1 } },
    { key: { city: 1 } },
    { key: { referredById: 1 } },
  ],
  categories: [{ key: { parentId: 1 } }, { key: { ancestors: 1 } }],
  products: [
    { key: { sku: 1 }, unique: true },
    {
      key: { name: 'text', tags: 'text', description: 'text' },
      weights: { name: 10, tags: 4, description: 1 },
      name: 'product_text',
    },
    // ESR (equality, sort, range): category subtree equality, then price sort / range.
    { key: { categoryPath: 1, priceCents: 1 } },
    { key: { categoryPath: 1, 'ratingSummary.avg': -1 } },
    { key: { brand: 1, priceCents: 1 } },
    { key: { priceCents: 1 } },
    { key: { categoryId: 1 } },
    // Attribute pattern: one multikey index covers every attribute of every category.
    { key: { 'attributes.k': 1, 'attributes.v': 1 } },
  ],
  orders: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { createdAt: 1 } },
    { key: { status: 1, createdAt: 1 } },
    { key: { 'items.productId': 1 } },
    { key: { 'items.categoryId': 1 } },
    { key: { deviceId: 1 } },
    {
      key: { 'payment.cardFingerprint': 1 },
      partialFilterExpression: { 'payment.cardFingerprint': { $type: 'string' } },
    },
  ],
  // The trailing _id lets "newest 5, ties by id" be answered from the index without a blocking sort.
  reviews: [{ key: { productId: 1, createdAt: -1, _id: -1 } }, { key: { userId: 1, productId: 1 } }],
  product_views: [{ key: { 'meta.productId': 1, ts: -1 } }, { key: { 'meta.userId': 1, ts: -1 } }],
  warehouses: [{ key: { 'stock.productId': 1 } }],
  outbox: [
    { key: { createdAt: -1 } },
    // TTL: processed events disappear after 7 days; pending ones (null) never expire.
    { key: { processedAt: 1 }, expireAfterSeconds: 7 * 24 * 3600 },
  ],
}

const FIVE_YEARS_SECONDS = 5 * 365 * 24 * 3600

/** Creates collections (validators, time series) and indexes. Safe to run repeatedly. */
export async function ensureMongoSchema(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name))

  for (const [name, schema] of Object.entries(validators)) {
    if (!existing.has(name)) await db.createCollection(name, { validator: { $jsonSchema: schema } })
  }
  if (!existing.has('product_views')) {
    await db.createCollection('product_views', {
      timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'hours' },
      expireAfterSeconds: FIVE_YEARS_SECONDS,
    })
  }
  for (const name of ['categories', 'warehouses', 'outbox', 'counters']) {
    if (!existing.has(name)) await db.createCollection(name)
  }
  for (const [name, list] of Object.entries(indexes)) {
    await db.collection(name).createIndexes(list)
  }
}
