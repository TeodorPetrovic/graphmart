import { resolve } from 'node:path'
import type { Dataset } from '../generate'
import { mysqlPool } from '../../../server/infrastructure/mysql/client'

const batchSize = 1_000
const tablesToAnalyze = [
  'users',
  'user_interests',
  'addresses',
  'categories',
  'products',
  'product_attributes',
  'product_tags',
  'orders',
  'order_items',
  'reviews',
  'product_views',
  'follows',
  'warehouses',
  'warehouse_stock',
  'routes',
]

export async function loadMysql(data: Dataset): Promise<void> {
  const connection = await mysqlPool().getConnection()
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    await dropExistingTables(connection)
    await createSchema(connection)
    await loadUsers(connection, data)
    await loadCatalog(connection, data)
    await loadCommerce(connection, data)
    await loadLogistics(connection, data)
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    for (const table of tablesToAnalyze) await connection.query(`ANALYZE TABLE ${table}`)
  } finally {
    connection.release()
  }
}

async function dropExistingTables(
  connection: Awaited<ReturnType<ReturnType<typeof mysqlPool>['getConnection']>>,
): Promise<void> {
  const [rows] = await connection.query<Array<Record<string, string>>>('SHOW TABLES')
  for (const row of rows) {
    const table = Object.values(row)[0]
    if (table) await connection.query(`DROP TABLE IF EXISTS \`${table}\``)
  }
}

async function createSchema(
  connection: Awaited<ReturnType<ReturnType<typeof mysqlPool>['getConnection']>>,
): Promise<void> {
  const schemaPath = resolve(import.meta.dir, '../../../database/mysql/schema.sql')
  const schema = await Bun.file(schemaPath).text()
  const statements = schema
    .replace(/^\s*--.*$/gm, '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
  for (const statement of statements) await connection.query(statement)
}

async function loadUsers(connection: DbConnection, data: Dataset): Promise<void> {
  await bulk(
    connection,
    'users',
    ['id', 'name', 'email', 'city', 'country', 'tier', 'created_at', 'referred_by_id'],
    data.users.map((user) => [
      user._id,
      user.name,
      user.email,
      user.city,
      user.country,
      user.tier,
      toMysqlDate(user.createdAt),
      user.referredById,
    ]),
  )
  const addresses: unknown[][] = []
  const interests: unknown[][] = []
  for (const user of data.users) {
    user.addresses.forEach((address, index) =>
      addresses.push([user._id * 10 + index + 1, user._id, address.label, address.street, address.city, address.zip]),
    )
    for (const interest of user.interests) interests.push([user._id, interest])
  }
  await bulk(connection, 'addresses', ['id', 'user_id', 'label', 'street', 'city', 'zip'], addresses)
  await bulk(connection, 'user_interests', ['user_id', 'interest'], interests)
}

async function loadCatalog(connection: DbConnection, data: Dataset): Promise<void> {
  await bulk(
    connection,
    'categories',
    ['id', 'name', 'parent_id'],
    data.categories.map((category) => [category._id, category.name, category.parentId]),
  )
  await bulk(
    connection,
    'brands',
    ['id', 'name'],
    data.brands.map((name, index) => [index + 1, name]),
  )
  await bulk(
    connection,
    'tags',
    ['id', 'name'],
    data.tags.map((name, index) => [index + 1, name]),
  )
  const attributes = [
    ...new Set(data.products.flatMap((product) => product.attributes.map((attribute) => attribute.k))),
  ]
  await bulk(
    connection,
    'attribute_definitions',
    ['id', 'name'],
    attributes.map((name, index) => [index + 1, name]),
  )
  const brandIds = new Map(data.brands.map((name, index) => [name, index + 1]))
  const attributeIds = new Map(attributes.map((name, index) => [name, index + 1]))
  const tagIds = new Map(data.tags.map((name, index) => [name, index + 1]))
  await bulk(
    connection,
    'products',
    [
      'id',
      'sku',
      'name',
      'description',
      'category_id',
      'brand_id',
      'price_cents',
      'stock',
      'rating_avg',
      'rating_count',
      'created_at',
    ],
    data.products.map((product) => [
      product._id,
      product.sku,
      product.name,
      product.description,
      product.categoryId,
      brandIds.get(product.brand)!,
      product.priceCents,
      product.stock,
      product.ratingSummary.avg,
      product.ratingSummary.count,
      toMysqlDate(product.createdAt),
    ]),
  )

  const productAttributes: unknown[][] = []
  const productTags: unknown[][] = []
  for (const product of data.products) {
    for (const attribute of product.attributes) {
      productAttributes.push([
        product._id,
        attributeIds.get(attribute.k)!,
        typeof attribute.v === 'string' ? attribute.v : null,
        typeof attribute.v === 'number' ? attribute.v : null,
        typeof attribute.v === 'boolean' ? Number(attribute.v) : null,
      ])
    }
    for (const tag of product.tags) productTags.push([product._id, tagIds.get(tag)!])
  }
  await bulk(
    connection,
    'product_attributes',
    ['product_id', 'attribute_id', 'value_text', 'value_number', 'value_bool'],
    productAttributes,
  )
  await bulk(connection, 'product_tags', ['product_id', 'tag_id'], productTags)
}

async function loadCommerce(connection: DbConnection, data: Dataset): Promise<void> {
  const addressIds = new Map<string, number>()
  for (const user of data.users) {
    user.addresses.forEach((address, index) =>
      addressIds.set(`${user._id}:${address.label}`, user._id * 10 + index + 1),
    )
  }
  await bulk(
    connection,
    'orders',
    [
      'id',
      'user_id',
      'status',
      'created_at',
      'total_cents',
      'payment_method',
      'card_fingerprint',
      'device_id',
      'shipping_address_id',
    ],
    data.orders.map((order) => [
      order._id,
      order.userId,
      order.status,
      toMysqlDate(order.createdAt),
      order.totalCents,
      order.payment.method,
      order.payment.cardFingerprint,
      order.deviceId,
      addressIds.get(`${order.userId}:${order.shippingAddress.label}`)!,
    ]),
  )
  const orderItems: unknown[][] = []
  for (const order of data.orders) {
    order.items.forEach((item, index) =>
      orderItems.push([order._id, index + 1, item.productId, item.name, item.unitPriceCents, item.quantity]),
    )
  }
  await bulk(
    connection,
    'order_items',
    ['order_id', 'line_no', 'product_id', 'product_name', 'unit_price_cents', 'quantity'],
    orderItems,
  )
  await bulk(
    connection,
    'reviews',
    ['id', 'product_id', 'user_id', 'rating', 'title', 'body', 'helpful_votes', 'created_at'],
    data.reviews.map((review) => [
      review._id,
      review.productId,
      review.userId,
      review.rating,
      review.title,
      review.body,
      review.helpfulVotes,
      toMysqlDate(review.createdAt),
    ]),
  )
  await bulk(
    connection,
    'product_views',
    ['user_id', 'product_id', 'viewed_at'],
    data.views.map((view) => [view.meta.userId, view.meta.productId, toMysqlDate(view.ts)]),
  )
  await bulk(
    connection,
    'follows',
    ['follower_id', 'followee_id', 'since'],
    data.follows.map((follow) => [follow.followerId, follow.followeeId, toMysqlDate(follow.since)]),
  )
}

async function loadLogistics(connection: DbConnection, data: Dataset): Promise<void> {
  await bulk(
    connection,
    'warehouses',
    ['id', 'name', 'city', 'lat', 'lng'],
    data.warehouses.map((warehouse) => [warehouse._id, warehouse.name, warehouse.city, warehouse.lat, warehouse.lng]),
  )
  const stock: unknown[][] = []
  for (const warehouse of data.warehouses) {
    for (const item of warehouse.stock) stock.push([warehouse._id, item.productId, item.quantity])
  }
  await bulk(connection, 'warehouse_stock', ['warehouse_id', 'product_id', 'quantity'], stock)
  await bulk(
    connection,
    'routes',
    ['from_id', 'to_id', 'distance_km', 'duration_min'],
    data.routes.map((route) => [route.fromId, route.toId, route.distanceKm, route.durationMin]),
  )
}

type DbConnection = Awaited<ReturnType<ReturnType<typeof mysqlPool>['getConnection']>>

async function bulk(connection: DbConnection, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  for (const batch of chunks(rows)) {
    const placeholders = `(${columns.map(() => '?').join(', ')})`
    const values = Array.from({ length: batch.length }, () => placeholders).join(', ')
    await connection.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`, batch.flat())
  }
}

function chunks<T>(rows: T[], size = batchSize): T[][] {
  const batches: T[][] = []
  for (let offset = 0; offset < rows.length; offset += size) batches.push(rows.slice(offset, offset + size))
  return batches
}

function toMysqlDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}
