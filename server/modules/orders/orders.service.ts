import { ObjectId, type ClientSession } from 'mongodb'
import type { CreateOrderRequest } from '../../../shared/types/api'
import type { Address, OrderDoc, OrderItem, OutboxDoc } from '../../../shared/types/domain'
import { addressKey } from '../../../shared/utils/address'
import { collections, mongoClient } from '../../infrastructure/mongo/client'
import { shell, type Tracer } from '../../infrastructure/trace'

type CommerceCollections = ReturnType<typeof collections>

export class OrderFailure extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
  }
}

async function reserveItems(
  input: CreateOrderRequest,
  session: ClientSession,
  db: CommerceCollections,
  tracer: Tracer,
): Promise<OrderItem[]> {
  const quantities = new Map<number, number>()
  for (const line of input.items) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
  }
  const items: OrderItem[] = []
  for (const [productId, quantity] of quantities) {
    const filter = { _id: productId }
    const product = await tracer.run('mongo', 'Load order product', shell('products', 'findOne', filter), () =>
      db.products.findOne(filter, { session }),
    )
    if (!product) throw new OrderFailure(404, `Product ${productId} not found`)

    // The conditional decrement is the inventory race guard; the transaction rolls back earlier lines.
    const stockFilter = { _id: productId, stock: { $gte: quantity } }
    const decrement = { $inc: { stock: -quantity } }
    const result = await tracer.run(
      'mongo',
      'Reserve stock conditionally',
      shell('products', 'updateOne', stockFilter, decrement),
      () => db.products.updateOne(stockFilter, decrement, { session }),
    )
    if (result.modifiedCount !== 1) throw new OrderFailure(409, `Insufficient stock for product ${productId}`)
    items.push({
      productId,
      name: product.name,
      categoryId: product.categoryId,
      unitPriceCents: product.priceCents,
      quantity,
    })
  }
  return items
}

function allocateOrderId(session: ClientSession, db: CommerceCollections, tracer: Tracer): Promise<number> {
  const filter = { _id: 'orders' }
  const update = { $inc: { seq: 1 } }
  return tracer.run('mongo', 'Allocate order id', shell('counters', 'findOneAndUpdate', filter, update), async () => {
    const counter = await db.counters.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
      session,
    })
    return counter?.seq ?? 1
  })
}

function makeOrder(input: CreateOrderRequest, items: OrderItem[], id: number, address: Address): OrderDoc {
  return {
    _id: id,
    userId: input.userId,
    status: 'paid',
    createdAt: new Date(),
    items,
    totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
    payment: { method: input.paymentMethod, cardFingerprint: input.cardFingerprint ?? null },
    deviceId: input.deviceId,
    shippingAddress: address,
  }
}

function makeOutboxEvent(order: OrderDoc, eventId: ObjectId): OutboxDoc & { _id: ObjectId } {
  return {
    _id: eventId,
    type: 'order.placed',
    event: {
      type: 'order.placed',
      order: {
        id: order._id,
        userId: order.userId,
        at: order.createdAt.toISOString(),
        items: order.items.map(({ productId, quantity }) => ({ productId, quantity })),
        deviceId: order.deviceId,
        cardFingerprint: order.payment.cardFingerprint,
        addressKey: addressKey(order.shippingAddress),
      },
    },
    createdAt: order.createdAt,
    processedAt: null,
    attempts: 0,
    error: null,
  }
}

async function createOrderInTransaction(
  input: CreateOrderRequest,
  eventId: ObjectId,
  session: ClientSession,
  db: CommerceCollections,
  tracer: Tracer,
): Promise<OrderDoc> {
  const userFilter = { _id: input.userId }
  const user = await tracer.run('mongo', 'Check order user', shell('users', 'findOne', userFilter), () =>
    db.users.findOne(userFilter, { session }),
  )
  if (!user) throw new OrderFailure(404, 'User not found')
  const shippingAddress = user.addresses[0]
  if (!shippingAddress) throw new OrderFailure(400, 'User has no shipping address')

  const items = await reserveItems(input, session, db, tracer)
  const orderId = await allocateOrderId(session, db, tracer)
  const order = makeOrder(input, items, orderId, shippingAddress)
  await tracer.run('mongo', 'Insert order', shell('orders', 'insertOne', order), () =>
    db.orders.insertOne(order, { session }),
  )
  const outboxEvent = makeOutboxEvent(order, eventId)
  await tracer.run('mongo', 'Write order outbox event', shell('outbox', 'insertOne', outboxEvent), () =>
    db.outbox.insertOne(outboxEvent, { session }),
  )
  return order
}

export async function createOrder(input: CreateOrderRequest, tracer: Tracer) {
  const db = collections()
  const session = mongoClient().startSession()
  const eventId = new ObjectId()
  let order: OrderDoc | undefined
  try {
    order = await session.withTransaction(() => createOrderInTransaction(input, eventId, session, db, tracer))
  } finally {
    await session.endSession()
  }
  if (!order) throw new Error('Order transaction completed without an order')
  return { order, eventId: eventId.toHexString() }
}
