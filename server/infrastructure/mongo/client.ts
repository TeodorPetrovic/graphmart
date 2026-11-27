import { MongoClient, type Db } from 'mongodb'
import { config } from '../config'
import type {
  CategoryDoc,
  CounterDoc,
  OrderDoc,
  OutboxDoc,
  ProductDoc,
  ProductViewDoc,
  ReviewDoc,
  UserDoc,
  Warehouse,
} from '../../../shared/types/domain'

let client: MongoClient | null = null

export function mongoClient(): MongoClient {
  client ??= new MongoClient(config.MONGO_URI, { serverSelectionTimeoutMS: 4000 })
  return client
}

export function mongoDb(): Db {
  return mongoClient().db(config.MONGO_DB)
}

/** Typed collection accessors. */
export function collections(db: Db = mongoDb()) {
  return {
    users: db.collection<UserDoc>('users'),
    categories: db.collection<CategoryDoc>('categories'),
    products: db.collection<ProductDoc>('products'),
    orders: db.collection<OrderDoc>('orders'),
    reviews: db.collection<ReviewDoc>('reviews'),
    productViews: db.collection<ProductViewDoc>('product_views'),
    warehouses: db.collection<Warehouse>('warehouses'),
    outbox: db.collection<OutboxDoc>('outbox'),
    counters: db.collection<CounterDoc>('counters'),
  }
}

export async function closeMongo(): Promise<void> {
  await client?.close()
  client = null
}
