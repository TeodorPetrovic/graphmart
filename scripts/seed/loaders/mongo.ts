import { collections, mongoDb } from '../../../server/infrastructure/mongo/client'
import { ensureMongoSchema } from '../../../server/infrastructure/mongo/schema'
import type { Dataset } from '../generate'

const batchSize = 1_000

export async function loadMongo(data: Dataset): Promise<void> {
  const database = mongoDb()
  await database.dropDatabase()
  await ensureMongoSchema(database)
  const databaseCollections = collections(database)

  await insertMany('users', data.users, databaseCollections.users)
  await insertMany('categories', data.categories, databaseCollections.categories)
  await insertMany('products', data.products, databaseCollections.products)
  await insertMany('orders', data.orders, databaseCollections.orders)
  await insertMany('reviews', data.reviews, databaseCollections.reviews)
  for (let offset = 0; offset < data.views.length; offset += batchSize) {
    await databaseCollections.productViews.insertMany(data.views.slice(offset, offset + batchSize))
  }
  console.log(`  product_views: ${data.views.length.toLocaleString()}`)
  await insertMany('warehouses', data.warehouses, databaseCollections.warehouses)
  await databaseCollections.counters.insertMany([
    { _id: 'users', seq: data.users.length },
    { _id: 'orders', seq: data.orders.length },
    { _id: 'reviews', seq: data.reviews.length },
  ])
}

async function insertMany<T extends { _id: number }>(
  collectionName: string,
  rows: T[],
  collection: { insertMany(documents: T[], options?: { ordered?: boolean }): Promise<unknown> },
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    await collection.insertMany(rows.slice(offset, offset + batchSize), { ordered: false })
  }
  console.log(`  ${collectionName}: ${rows.length.toLocaleString()}`)
}
