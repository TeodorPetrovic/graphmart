/**
 * Domain model. All ids are integers and identical in MySQL, MongoDB (`_id`)
 * and Neo4j (`id` property), so the three engines can be compared row by row.
 */
export type Tier = 'bronze' | 'silver' | 'gold'
export type OrderStatus = 'paid' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentMethod = 'card' | 'paypal' | 'cash_on_delivery'
export type AttributeValue = string | number | boolean

export interface Address {
  label: string
  street: string
  city: string
  zip: string
}

/** MongoDB collection `users`. */
export interface UserDoc {
  _id: number
  name: string
  email: string
  city: string
  country: string
  tier: Tier
  createdAt: Date
  interests: string[]
  addresses: Address[]
  referredById: number | null
}

/** MongoDB collection `categories` (tree: parent reference + materialised ancestors). */
export interface CategoryDoc {
  _id: number
  name: string
  parentId: number | null
  ancestors: number[]
  depth: number
}

/** Attribute pattern: indexable list of key/value pairs (replaces the MySQL EAV table). */
export interface ProductAttribute {
  k: string
  v: AttributeValue
}

/** MongoDB collection `products`. */
export interface ProductDoc {
  _id: number
  sku: string
  name: string
  description: string
  categoryId: number
  /** Category id plus all ancestor ids, for subtree filtering with one index. */
  categoryPath: number[]
  brand: string
  priceCents: number
  stock: number
  attributes: ProductAttribute[]
  tags: string[]
  ratingSummary: { avg: number; count: number; sum: number }
  createdAt: Date
}

/** Snapshot of the product at purchase time, embedded in the order. */
export interface OrderItem {
  productId: number
  name: string
  categoryId: number
  unitPriceCents: number
  quantity: number
}

/** MongoDB collection `orders`. */
export interface OrderDoc {
  _id: number
  userId: number
  status: OrderStatus
  createdAt: Date
  items: OrderItem[]
  totalCents: number
  payment: { method: PaymentMethod; cardFingerprint: string | null }
  deviceId: string
  shippingAddress: Address
}

/** MongoDB collection `reviews`. */
export interface ReviewDoc {
  _id: number
  productId: number
  userId: number
  userName: string
  rating: number
  title: string
  body: string
  helpfulVotes: number
  createdAt: Date
}

/** MongoDB time series collection `product_views` (timeField `ts`, metaField `meta`). */
export interface ProductViewDoc {
  ts: Date
  meta: { userId: number; productId: number }
}

/** Relationship owned by Neo4j (source of truth). Seeded into MySQL for comparison. */
export interface Follow {
  followerId: number
  followeeId: number
  since: Date
}

/** MongoDB collection `warehouses`. */
export interface Warehouse {
  _id: number
  name: string
  city: string
  lat: number
  lng: number
  /** Embedded stock list: product id and quantity held in this warehouse. */
  stock: { productId: number; quantity: number }[]
}

/** Directed transport link between two warehouses. */
export interface Route {
  fromId: number
  toId: number
  distanceKm: number
  durationMin: number
}

export type OutboxEventType =
  'user.registered' | 'product.upserted' | 'order.placed' | 'review.created' | 'product.viewed'

export type OutboxPayload =
  | {
      type: 'user.registered'
      user: { id: number; name: string; city: string; tier: Tier; referredById: number | null; at: string }
    }
  | {
      type: 'product.upserted'
      product: { id: number; name: string; priceCents: number; brand: string; categoryId: number }
    }
  | {
      type: 'order.placed'
      order: {
        id: number
        userId: number
        at: string
        items: { productId: number; quantity: number }[]
        deviceId: string
        cardFingerprint: string | null
        addressKey: string
      }
    }
  | { type: 'review.created'; review: { id: number; userId: number; productId: number; rating: number; at: string } }
  | { type: 'product.viewed'; view: { userId: number; productId: number; at: string } }

/** MongoDB collection `outbox` (transactional outbox, consumed through a change stream). */
export interface OutboxDoc {
  type: OutboxEventType
  event: OutboxPayload
  createdAt: Date
  processedAt: Date | null
  attempts: number
  error: string | null
}

/** MongoDB collection `counters` (id sequences: `orders`, `reviews`, `users`). */
export interface CounterDoc {
  _id: string
  seq: number
}
