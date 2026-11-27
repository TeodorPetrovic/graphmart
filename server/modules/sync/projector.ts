import { ObjectId, type ChangeStream } from 'mongodb'
import { collections, mongoDb } from '../../infrastructure/mongo/client'
import type { OutboxDoc, OutboxPayload } from '../../../shared/types/domain'
import { shell, type Tracer } from '../../infrastructure/trace'
import { MAX_OUTBOX_ATTEMPTS, OUTBOX_POLL_INTERVAL_MS } from './constants'
import { isOutage } from './outage'
import { withProjectionLock } from './projection-lock'
import { projectPlacedOrder } from './projections/order-placed'
import { projectProductView } from './projections/product-viewed'
import { projectCreatedReview } from './projections/review-created'
import { projectRegisteredUser } from './projections/user-registered'
import { projectUpsertedProduct } from './projections/product-upserted'

let running = false
let startedAt: Date | null = null
let lastEventAt: Date | null = null
let lastError: string | null = null
type StoredOutboxEvent = OutboxDoc & { _id: ObjectId }
let lifecycleGeneration = 0

let stream: ChangeStream<StoredOutboxEvent> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let streamTask: Promise<void> | null = null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function project(event: OutboxPayload, eventId: string, tracer?: Tracer): Promise<void> {
  switch (event.type) {
    case 'user.registered':
      await projectRegisteredUser(event, tracer)
      return
    case 'product.upserted':
      await projectUpsertedProduct(event, tracer)
      return
    case 'order.placed':
      await projectPlacedOrder(event, tracer)
      return
    case 'review.created':
      await projectCreatedReview(event, tracer)
      return
    case 'product.viewed':
      await projectProductView(event, eventId, tracer)
  }
}

function outboxId(event: StoredOutboxEvent): string {
  return event._id.toHexString()
}

async function nextOutboxEvent(tracer?: Tracer): Promise<StoredOutboxEvent | null> {
  const db = collections()
  const filter = { processedAt: null, attempts: { $lt: MAX_OUTBOX_ATTEMPTS } }
  const sort: { createdAt: 1; _id: 1 } = { createdAt: 1, _id: 1 }
  const read = () => db.outbox.findOne(filter, { sort })
  try {
    if (!tracer) return read()
    return await tracer.run(
      'mongo',
      'Read next outbox event',
      'db.outbox.findOne({processedAt:null,attempts:{$lt:5}}).sort({createdAt:1,_id:1})',
      read,
    )
  } catch (error) {
    lastError = errorMessage(error)
    return null
  }
}

async function markEventProcessed(event: StoredOutboxEvent, tracer?: Tracer): Promise<void> {
  const db = collections()
  const filter = { _id: event._id }
  const update = { $set: { processedAt: new Date(), error: null } }
  const write = () => db.outbox.updateOne(filter, update)
  if (tracer) {
    await tracer.run('mongo', 'Mark outbox event processed', shell('outbox', 'updateOne', filter, update), write)
  } else {
    await write()
  }
}

async function recordProjectionFailure(event: StoredOutboxEvent, error: unknown, tracer?: Tracer): Promise<boolean> {
  const message = errorMessage(error)
  lastError = message
  // Leave the event pending; the periodic poll retries it once Neo4j is back.
  if (isOutage(error)) return false
  const failed = event.attempts + 1 >= MAX_OUTBOX_ATTEMPTS
  const filter = { _id: event._id }
  const update = {
    $inc: { attempts: 1 },
    $set: { error: message, ...(failed ? { processedAt: new Date() } : {}) },
  }
  const db = collections()
  const write = () => db.outbox.updateOne(filter, update)
  try {
    if (tracer) {
      await tracer.run('mongo', 'Record outbox projection failure', shell('outbox', 'updateOne', filter, update), write)
    } else {
      await write()
    }
    return failed
  } catch (updateError) {
    lastError = errorMessage(updateError)
    return false
  }
}

async function projectNextEvent(tracer?: Tracer): Promise<boolean> {
  const event = await nextOutboxEvent(tracer)
  if (!event) return false
  try {
    await project(event.event, outboxId(event), tracer)
    await markEventProcessed(event, tracer)
    lastEventAt = event.createdAt
    lastError = null
    return true
  } catch (error) {
    return recordProjectionFailure(event, error, tracer)
  }
}

export async function drainOutbox(tracer?: Tracer): Promise<void> {
  if (!running) return
  await withProjectionLock(async () => {
    while (running) {
      const hasMore = await projectNextEvent(tracer)
      if (!hasMore) break
    }
  })
}

async function watchOutbox(generation: number): Promise<void> {
  while (running && generation === lifecycleGeneration) {
    let currentStream: ChangeStream<StoredOutboxEvent> | null = null
    try {
      currentStream = mongoDb()
        .collection<StoredOutboxEvent>('outbox')
        .watch([{ $match: { operationType: 'insert' } }])
      stream = currentStream
      for await (const _change of currentStream) {
        if (!running || generation !== lifecycleGeneration) break
        await drainOutbox()
      }
    } catch (error) {
      if (running && generation === lifecycleGeneration) lastError = errorMessage(error)
    } finally {
      await currentStream?.close().catch(() => undefined)
      if (stream === currentStream) stream = null
    }
    if (running && generation === lifecycleGeneration) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

export async function startProjector(): Promise<void> {
  if (running) return
  running = true
  const generation = ++lifecycleGeneration
  startedAt = new Date()
  await drainOutbox()
  if (!running || generation !== lifecycleGeneration) return
  streamTask = watchOutbox(generation)
  pollTimer = setInterval(() => void drainOutbox(), OUTBOX_POLL_INTERVAL_MS)
}

export async function stopProjector(): Promise<void> {
  running = false
  lifecycleGeneration += 1
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  const closingStream = stream
  await closingStream?.close().catch(() => undefined)
  if (stream === closingStream) stream = null
  const stoppingTask = streamTask
  await stoppingTask
  if (streamTask === stoppingTask) streamTask = null
}

export function projectorState() {
  return {
    running,
    startedAt: startedAt?.toISOString() ?? null,
    lastEventAt: lastEventAt?.toISOString() ?? null,
    lastError,
  }
}
