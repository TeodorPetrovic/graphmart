// Creates the GraphMart collections and indexes. Paste it into the Compass shell, or run
//   mongosh --file database/mongodb/setup.js
// then import each .json file in this folder into the collection with the same name.
// Written by `bun run db:export`; edit server/infrastructure/mongo/schema.ts instead.
const schema = {
  validators: {
    users: {
      bsonType: 'object',
      required: ['_id', 'name', 'email', 'tier', 'addresses'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[^@]+@[^@]+$',
        },
        tier: {
          enum: ['bronze', 'silver', 'gold'],
        },
        addresses: {
          bsonType: 'array',
        },
      },
    },
    products: {
      bsonType: 'object',
      required: ['_id', 'sku', 'name', 'priceCents', 'stock', 'categoryPath', 'attributes'],
      properties: {
        priceCents: {
          bsonType: ['int', 'long', 'double'],
          minimum: 0,
        },
        stock: {
          bsonType: ['int', 'long', 'double'],
          minimum: 0,
        },
        attributes: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['k', 'v'],
          },
        },
      },
    },
    orders: {
      bsonType: 'object',
      required: ['_id', 'userId', 'status', 'items', 'totalCents', 'createdAt'],
      properties: {
        status: {
          enum: ['paid', 'shipped', 'delivered', 'cancelled'],
        },
        items: {
          bsonType: 'array',
          minItems: 1,
        },
      },
    },
    reviews: {
      bsonType: 'object',
      required: ['_id', 'productId', 'userId', 'rating'],
      properties: {
        rating: {
          bsonType: ['int', 'long', 'double'],
          minimum: 1,
          maximum: 5,
        },
      },
    },
  },
  indexes: {
    users: [
      {
        key: {
          email: 1,
        },
        unique: true,
      },
      {
        key: {
          name: 1,
        },
      },
      {
        key: {
          city: 1,
        },
      },
      {
        key: {
          referredById: 1,
        },
      },
    ],
    categories: [
      {
        key: {
          parentId: 1,
        },
      },
      {
        key: {
          ancestors: 1,
        },
      },
    ],
    products: [
      {
        key: {
          sku: 1,
        },
        unique: true,
      },
      {
        key: {
          name: 'text',
          tags: 'text',
          description: 'text',
        },
        weights: {
          name: 10,
          tags: 4,
          description: 1,
        },
        name: 'product_text',
      },
      {
        key: {
          categoryPath: 1,
          priceCents: 1,
        },
      },
      {
        key: {
          categoryPath: 1,
          'ratingSummary.avg': -1,
        },
      },
      {
        key: {
          brand: 1,
          priceCents: 1,
        },
      },
      {
        key: {
          priceCents: 1,
        },
      },
      {
        key: {
          categoryId: 1,
        },
      },
      {
        key: {
          'attributes.k': 1,
          'attributes.v': 1,
        },
      },
    ],
    orders: [
      {
        key: {
          userId: 1,
          createdAt: -1,
        },
      },
      {
        key: {
          createdAt: 1,
        },
      },
      {
        key: {
          status: 1,
          createdAt: 1,
        },
      },
      {
        key: {
          'items.productId': 1,
        },
      },
      {
        key: {
          'items.categoryId': 1,
        },
      },
      {
        key: {
          deviceId: 1,
        },
      },
      {
        key: {
          'payment.cardFingerprint': 1,
        },
        partialFilterExpression: {
          'payment.cardFingerprint': {
            $type: 'string',
          },
        },
      },
    ],
    reviews: [
      {
        key: {
          productId: 1,
          createdAt: -1,
          _id: -1,
        },
      },
      {
        key: {
          userId: 1,
          productId: 1,
        },
      },
    ],
    product_views: [
      {
        key: {
          'meta.productId': 1,
          ts: -1,
        },
      },
      {
        key: {
          'meta.userId': 1,
          ts: -1,
        },
      },
    ],
    warehouses: [
      {
        key: {
          'stock.productId': 1,
        },
      },
    ],
    outbox: [
      {
        key: {
          createdAt: -1,
        },
      },
      {
        key: {
          processedAt: 1,
        },
        expireAfterSeconds: 604800,
      },
    ],
  },
  timeSeries: {
    product_views: {
      timeseries: {
        timeField: 'ts',
        metaField: 'meta',
        granularity: 'hours',
      },
      expireAfterSeconds: 157680000,
    },
  },
  plain: ['categories', 'warehouses', 'outbox', 'counters'],
}
const target = db.getSiblingDB('graphmart')
const existing = target.getCollectionNames()
const create = (name, options) => existing.includes(name) || target.createCollection(name, options)
for (const [name, rules] of Object.entries(schema.validators)) create(name, { validator: { $jsonSchema: rules } })
for (const [name, options] of Object.entries(schema.timeSeries)) create(name, options)
for (const name of schema.plain) create(name)
for (const [name, list] of Object.entries(schema.indexes)) {
  for (const { key, ...options } of list) target.getCollection(name).createIndex(key, options)
}
print('GraphMart collections and indexes are ready.')
