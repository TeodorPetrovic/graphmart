import { addressKey } from '../../../shared/utils/address'
import type { Tracer } from '../../infrastructure/trace'
import { config } from '../../infrastructure/config'
import { collections, mongoDb } from '../../infrastructure/mongo/client'
import { ensureNeo4jSchema } from '../../infrastructure/neo4j/schema'
import { int as neoInt, neo4jDriver } from '../../infrastructure/neo4j/client'

const BATCH = 1_000
type Row = Record<string, unknown>

async function writeBatch(cypher: string, rows: Row[]): Promise<void> {
  if (!rows.length) return
  await neo4jDriver().executeQuery(cypher, { rows: rows.map(asNeo4jValue) }, { database: config.NEO4J_DATABASE })
}

function asNeo4jValue(value: unknown): unknown {
  if (typeof value === 'number' && Number.isInteger(value)) return neoInt(value)
  if (Array.isArray(value)) return value.map(asNeo4jValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, asNeo4jValue(nested)]))
  return value
}

async function projectCursor<T extends Row>(
  cursor: AsyncIterable<T>,
  cypher: string,
  transform: (doc: T) => Row,
  tracer: Tracer | undefined,
  operation: string,
  weight?: (doc: T) => number,
): Promise<number> {
  let batch: Row[] = []
  let count = 0
  for await (const doc of cursor) {
    batch.push(transform(doc))
    count += weight ? weight(doc) : 1
    if (batch.length === BATCH) {
      const start = performance.now()
      await writeBatch(cypher, batch)
      tracer?.entries.push({
        engine: 'neo4j',
        operation,
        query: `${cypher.trim()}\n// batch rows: ${batch.length}`,
        ms: Math.round((performance.now() - start) * 100) / 100,
      })
      batch = []
    }
  }
  if (batch.length) {
    const start = performance.now()
    await writeBatch(cypher, batch)
    tracer?.entries.push({
      engine: 'neo4j',
      operation,
      query: `${cypher.trim()}\n// batch rows: ${batch.length}`,
      ms: Math.round((performance.now() - start) * 100) / 100,
    })
  }
  return count
}

/** Rebuild Mongo-owned graph projections while leaving Neo4j-owned FOLLOWS / ROUTE_TO intact. */
export async function rebuildProjections(tracer?: Tracer): Promise<Record<string, number>> {
  await ensureNeo4jSchema()
  const session = neo4jDriver().session({ database: config.NEO4J_DATABASE })
  try {
    // Auto-commit is required by IN TRANSACTIONS; retain shared User/Warehouse endpoints.
    const relationshipCleanup = `
      MATCH ()-[relationship]->()
      WHERE type(relationship) IN [
        'REFERRED', 'PURCHASED', 'VIEWED', 'RATED', 'IN_CATEGORY',
        'SUBCATEGORY_OF', 'MADE_BY', 'USED_DEVICE', 'PAID_WITH', 'SHIPS_TO', 'STOCKS'
      ]
      CALL { WITH relationship DELETE relationship } IN TRANSACTIONS OF 10000 ROWS
    `
    const relationshipCleanupStarted = performance.now()
    await session.run(relationshipCleanup)
    tracer?.entries.push({
      engine: 'neo4j',
      operation: 'clear projected relationships',
      query: relationshipCleanup.trim(),
      ms: Math.round((performance.now() - relationshipCleanupStarted) * 100) / 100,
    })

    const nodeCleanup = `
      MATCH (node)
      WHERE any(label IN labels(node) WHERE label IN ['Product', 'Category', 'Brand', 'Device', 'Card', 'Address'])
      CALL { WITH node DETACH DELETE node } IN TRANSACTIONS OF 10000 ROWS
    `
    const nodeCleanupStarted = performance.now()
    await session.run(nodeCleanup)
    tracer?.entries.push({
      engine: 'neo4j',
      operation: 'clear projected nodes',
      query: nodeCleanup.trim(),
      ms: Math.round((performance.now() - nodeCleanupStarted) * 100) / 100,
    })
  } finally {
    await session.close()
  }

  const c = collections(mongoDb())
  const counts: Record<string, number> = {}
  counts.User = await projectCursor(
    c.users.find().sort({ _id: 1 }).batchSize(BATCH),
    `
      UNWIND $rows AS row
      MERGE (user:User {id: row.id})
      SET user.name = row.name,
          user.city = row.city,
          user.tier = row.tier
    `,
    (x) => ({ id: x._id, name: x.name, city: x.city, tier: x.tier }),
    tracer,
    'project users',
  )
  counts.Category = await projectCursor(
    c.categories.find().sort({ _id: 1 }).batchSize(BATCH),
    `
      UNWIND $rows AS row
      MERGE (category:Category {id: row.id})
      SET category.name = row.name
    `,
    (x) => ({ id: x._id, name: x.name }),
    tracer,
    'project categories',
  )
  await projectCursor(
    c.categories
      .find({ parentId: { $ne: null } })
      .sort({ _id: 1 })
      .batchSize(BATCH),
    `
      UNWIND $rows AS row
      MATCH (child:Category {id: row.id})
      MATCH (parent:Category {id: row.parentId})
      MERGE (child)-[:SUBCATEGORY_OF]->(parent)
    `,
    (category) => ({ id: category._id, parentId: category.parentId }),
    tracer,
    'project category parents',
  )
  counts.Product = await projectCursor(
    c.products.find().sort({ _id: 1 }).batchSize(BATCH),
    `
      UNWIND $rows AS row
      MERGE (product:Product {id: row.id})
      SET product.name = row.name,
          product.priceCents = row.priceCents,
          product.brand = row.brand
    `,
    (x) => ({ id: x._id, name: x.name, priceCents: x.priceCents, brand: x.brand }),
    tracer,
    'project products',
  )
  counts.Brand = await projectCursor(
    c.products.aggregate(
      [
        { $group: { _id: '$brand' } },
        { $sort: { _id: 1 } },
        { $project: { name: '$_id' } },
        { $unset: '_id' },
        { $limit: 1000 },
      ],
      { batchSize: BATCH },
    ),
    `
      UNWIND $rows AS row
      MERGE (:Brand {name: row.name})
    `,
    (x) => ({ name: x.name }),
    tracer,
    'project brands',
  )
  counts.Warehouse = await projectCursor(
    c.warehouses.find().sort({ _id: 1 }).batchSize(BATCH),
    `
      UNWIND $rows AS row
      MERGE (warehouse:Warehouse {id: row.id})
      SET warehouse.name = row.name,
          warehouse.city = row.city,
          warehouse.lat = row.lat,
          warehouse.lng = row.lng
    `,
    (x) => ({ id: x._id, name: x.name, city: x.city, lat: x.lat, lng: x.lng }),
    tracer,
    'project warehouses',
  )
  await projectCursor(
    c.products
      .find({}, { projection: { _id: 1, brand: 1 } })
      .sort({ _id: 1 })
      .batchSize(BATCH),
    `
      UNWIND $rows AS row
      MATCH (product:Product {id: row.id})
      MATCH (brand:Brand {name: row.brand})
      MERGE (product)-[:MADE_BY]->(brand)
    `,
    (x) => ({ id: x._id, brand: x.brand }),
    tracer,
    'project product brands',
  )
  await projectCursor(
    c.products
      .find({}, { projection: { _id: 1, categoryId: 1 } })
      .sort({ _id: 1 })
      .batchSize(BATCH),
    `
      UNWIND $rows AS row
      MATCH (product:Product {id: row.id})
      MATCH (category:Category {id: row.categoryId})
      MERGE (product)-[:IN_CATEGORY]->(category)
    `,
    (x) => ({ id: x._id, categoryId: x.categoryId }),
    tracer,
    'project product categories',
  )
  counts.REFERRED = await projectCursor(
    c.users
      .find({ referredById: { $ne: null } })
      .sort({ _id: 1 })
      .batchSize(BATCH),
    `
      UNWIND $rows AS row
      MATCH (referrer:User {id: row.referrerId})
      MATCH (referred:User {id: row.id})
      MERGE (referrer)-[relationship:REFERRED]->(referred)
      SET relationship.at = datetime(row.at)
    `,
    (x) => ({ id: x._id, referrerId: x.referredById, at: x.createdAt.toISOString() }),
    tracer,
    'project referrals',
  )

  counts.PURCHASED = await projectCursor(
    c.orders
      .find({ status: { $ne: 'cancelled' } })
      .sort({ _id: 1 })
      .batchSize(BATCH),
    `
      UNWIND $rows AS row
      MATCH (user:User {id: row.userId})
      UNWIND row.items AS item
      MATCH (product:Product {id: item.productId})
      MERGE (user)-[relationship:PURCHASED {orderId: row.orderId}]->(product)
      SET relationship.quantity = item.quantity,
          relationship.at = datetime(row.at)
    `,
    (x) => ({
      orderId: x._id,
      userId: x.userId,
      at: x.createdAt.toISOString(),
      items: x.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }),
    tracer,
    'project purchases',
    (x) => x.items.length,
  )
  counts.VIEWED = await projectCursor(
    c.productViews.aggregate(
      [
        {
          $group: {
            _id: { userId: '$meta.userId', productId: '$meta.productId' },
            count: { $sum: 1 },
            lastAt: { $max: '$ts' },
          },
        },
        { $sort: { '_id.userId': 1, '_id.productId': 1 } },
        { $project: { userId: '$_id.userId', productId: '$_id.productId', count: 1, lastAt: 1 } },
      ],
      { batchSize: BATCH },
    ),
    `
      UNWIND $rows AS row
      MATCH (user:User {id: row.userId})
      MATCH (product:Product {id: row.productId})
      MERGE (user)-[relationship:VIEWED]->(product)
      SET relationship.count = row.count,
          relationship.lastAt = datetime(row.lastAt)
    `,
    (x) => ({ userId: x.userId, productId: x.productId, count: x.count, lastAt: x.lastAt.toISOString() }),
    tracer,
    'project views',
  )
  counts.RATED = await projectCursor(
    c.reviews.find().sort({ _id: 1 }).batchSize(BATCH),
    `
      UNWIND $rows AS row
      MATCH (user:User {id: row.userId})
      MATCH (product:Product {id: row.productId})
      MERGE (user)-[relationship:RATED {reviewId: row.reviewId}]->(product)
      SET relationship.rating = row.rating,
          relationship.at = datetime(row.at)
    `,
    (x) => ({
      reviewId: x._id,
      userId: x.userId,
      productId: x.productId,
      rating: x.rating,
      at: x.createdAt.toISOString(),
    }),
    tracer,
    'project reviews',
  )

  const orderCursor = c.orders
    .find({ status: { $ne: 'cancelled' } })
    .sort({ _id: 1 })
    .batchSize(BATCH)
  let affinityRows: Row[] = []
  const userAddresses = new Set<string>(),
    userCards = new Set<string>(),
    userDevices = new Set<string>()
  for await (const order of orderCursor) {
    const addr = order.shippingAddress
    affinityRows.push({
      userId: order.userId,
      deviceId: order.deviceId,
      cardFingerprint: order.payment.cardFingerprint,
      addressKey: addressKey(addr),
      address: addr,
      at: order.createdAt.toISOString(),
    })
    userAddresses.add(`${order.userId}:${addressKey(addr)}`)
    userDevices.add(`${order.userId}:${order.deviceId}`)
    if (order.payment.cardFingerprint) userCards.add(`${order.userId}:${order.payment.cardFingerprint}`)
    if (affinityRows.length === BATCH) {
      await projectAffinity(affinityRows)
      affinityRows = []
    }
  }
  if (affinityRows.length) await projectAffinity(affinityRows)
  async function projectAffinity(rows: Row[]) {
    const cypher = `
        UNWIND $rows AS row
        MATCH (user:User {id: row.userId})
        MERGE (address:Address {key: row.addressKey})
        SET address.street = row.address.street,
            address.city = row.address.city,
            address.zip = row.address.zip
        MERGE (user)-[:SHIPS_TO]->(address)
        FOREACH (_ IN CASE WHEN row.cardFingerprint IS NULL THEN [] ELSE [1] END |
          MERGE (card:Card {fingerprint: row.cardFingerprint})
          MERGE (user)-[:PAID_WITH]->(card)
        )
        MERGE (device:Device {id: row.deviceId})
        MERGE (user)-[:USED_DEVICE]->(device)
      `
    const startedAt = performance.now()
    await writeBatch(cypher, rows)
    tracer?.entries.push({
      engine: 'neo4j',
      operation: 'project user affinities',
      query: `${cypher.trim()}\n// batch rows: ${rows.length}`,
      ms: Math.round((performance.now() - startedAt) * 100) / 100,
    })
  }
  counts.Address = new Set([...userAddresses].map((pair) => pair.slice(pair.indexOf(':') + 1))).size
  counts.Device = new Set([...userDevices].map((pair) => pair.slice(pair.indexOf(':') + 1))).size
  counts.Card = new Set([...userCards].map((pair) => pair.slice(pair.indexOf(':') + 1))).size
  counts.SHIPS_TO = userAddresses.size
  counts.PAID_WITH = userCards.size
  counts.USED_DEVICE = userDevices.size
  counts.IN_CATEGORY = await c.products.countDocuments()
  counts.MADE_BY = await c.products.countDocuments()
  counts.SUBCATEGORY_OF = await c.categories.countDocuments({ parentId: { $ne: null } })
  counts.STOCKS = await projectCursor(
    c.warehouses.aggregate([{ $unwind: '$stock' }, { $sort: { _id: 1 } }], { batchSize: BATCH }),
    `
      UNWIND $rows AS row
      MATCH (warehouse:Warehouse {id: row.warehouseId})
      MATCH (product:Product {id: row.productId})
      MERGE (warehouse)-[relationship:STOCKS]->(product)
      SET relationship.quantity = row.quantity
    `,
    (x) => ({ warehouseId: x._id, productId: x.stock.productId, quantity: x.stock.quantity }),
    tracer,
    'project stock',
  )
  return counts
}
