import { ObjectId } from 'mongodb'
import type { SyncEventView, SyncStatusResponse } from '../../../shared/types/api'
import type { OutboxDoc } from '../../../shared/types/domain'
import { collections } from '../../infrastructure/mongo/client'
import { shell, type Tracer } from '../../infrastructure/trace'
import { MAX_OUTBOX_ATTEMPTS } from './constants'

type StoredOutboxEvent = OutboxDoc & { _id: ObjectId }
type ProjectorStatus = SyncStatusResponse['projector']

function eventId(event: StoredOutboxEvent): string {
  return event._id.toHexString()
}

function eventView(event: StoredOutboxEvent): SyncEventView {
  return {
    id: eventId(event),
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    processedAt: event.processedAt?.toISOString() ?? null,
    lagMs: event.processedAt ? event.processedAt.getTime() - event.createdAt.getTime() : null,
    attempts: event.attempts,
    error: event.error,
  }
}

export async function outboxStatus(tracer: Tracer, projector: ProjectorStatus) {
  const db = collections()
  const recentFilter = {}
  const [pending, processed, failed, recent] = await Promise.all([
    tracer.run(
      'mongo',
      'Count pending outbox events',
      'db.outbox.countDocuments({processedAt:null,attempts:{$lt:5}})',
      () => db.outbox.countDocuments({ processedAt: null, attempts: { $lt: MAX_OUTBOX_ATTEMPTS } }),
    ),
    tracer.run(
      'mongo',
      'Count processed outbox events',
      'db.outbox.countDocuments({processedAt:{$ne:null},attempts:{$lt:5}})',
      () => db.outbox.countDocuments({ processedAt: { $ne: null }, attempts: { $lt: MAX_OUTBOX_ATTEMPTS } }),
    ),
    tracer.run('mongo', 'Count failed outbox events', 'db.outbox.countDocuments({attempts:{$gte:5}})', () =>
      db.outbox.countDocuments({ attempts: { $gte: MAX_OUTBOX_ATTEMPTS } }),
    ),
    tracer.run('mongo', 'Read recent outbox events', 'db.outbox.find({}).sort({createdAt:-1}).limit(20)', () =>
      db.outbox.find(recentFilter).sort({ createdAt: -1 }).limit(20).toArray(),
    ),
  ])
  return {
    projector,
    counts: { pending, processed, failed },
    recent: recent.map(eventView),
  }
}
