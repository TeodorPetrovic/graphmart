import { ObjectId } from 'mongodb'
import type { CreateReviewRequest } from '../../../shared/types/api'
import type { OutboxDoc, ReviewDoc } from '../../../shared/types/domain'
import { writeTogether, type WriteScope } from '../../infrastructure/mongo/atomic'
import { collections } from '../../infrastructure/mongo/client'
import { shell, type Tracer } from '../../infrastructure/trace'

type CommerceCollections = ReturnType<typeof collections>

export class ReviewFailure extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
  }
}

/** Adds one rating to a product's summary, or removes it again when `direction` is -1. */
function ratingUpdatePipeline(rating: number, direction: 1 | -1 = 1) {
  const count = { $add: ['$ratingSummary.count', direction] }
  const sum = { $add: ['$ratingSummary.sum', direction * rating] }
  const average = { $cond: [{ $gt: [count, 0] }, { $divide: [sum, { $max: [count, 1] }] }, 0] }
  return [{ $set: { 'ratingSummary.count': count, 'ratingSummary.sum': sum, 'ratingSummary.avg': average } }]
}

async function nextReviewId(session: WriteScope['session'], db: CommerceCollections, tracer: Tracer): Promise<number> {
  const filter = { _id: 'reviews' }
  const update = { $inc: { seq: 1 } }
  return tracer.run('mongo', 'Allocate review id', shell('counters', 'findOneAndUpdate', filter, update), async () => {
    const counter = await db.counters.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
      session,
    })
    return counter?.seq ?? 1
  })
}

async function saveReview(
  review: ReviewDoc,
  eventId: ObjectId,
  { session, onFailure }: WriteScope,
  db: CommerceCollections,
  tracer: Tracer,
): Promise<void> {
  await tracer.run('mongo', 'Insert review', shell('reviews', 'insertOne', review), () =>
    db.reviews.insertOne(review, { session }),
  )
  onFailure(() => db.reviews.deleteOne({ _id: review._id }))
  const summaryFilter = { _id: review.productId }
  const summaryPipeline = ratingUpdatePipeline(review.rating)
  await tracer.run(
    'mongo',
    'Update product rating summary atomically',
    shell('products', 'updateOne', summaryFilter, summaryPipeline),
    () => db.products.updateOne(summaryFilter, summaryPipeline, { session }),
  )
  onFailure(() => db.products.updateOne(summaryFilter, ratingUpdatePipeline(review.rating, -1)))
  const outboxEvent = {
    _id: eventId,
    type: 'review.created',
    event: {
      type: 'review.created',
      review: {
        id: review._id,
        userId: review.userId,
        productId: review.productId,
        rating: review.rating,
        at: review.createdAt.toISOString(),
      },
    },
    createdAt: review.createdAt,
    processedAt: null,
    attempts: 0,
    error: null,
  } satisfies OutboxDoc & { _id: ObjectId }
  await tracer.run('mongo', 'Write review outbox event', shell('outbox', 'insertOne', outboxEvent), () =>
    db.outbox.insertOne(outboxEvent, { session }),
  )
}

async function addReview(
  productId: number,
  input: CreateReviewRequest,
  eventId: ObjectId,
  scope: WriteScope,
  db: CommerceCollections,
  tracer: Tracer,
): Promise<ReviewDoc> {
  const { session } = scope
  const userFilter = { _id: input.userId }
  const productFilter = { _id: productId }
  const user = await tracer.run('mongo', 'Check review user', shell('users', 'findOne', userFilter), () =>
    db.users.findOne(userFilter, { session }),
  )
  if (!user) throw new ReviewFailure(404, 'User not found')
  const product = await tracer.run('mongo', 'Check reviewed product', shell('products', 'findOne', productFilter), () =>
    db.products.findOne(productFilter, { session }),
  )
  if (!product) throw new ReviewFailure(404, 'Product not found')
  const review: ReviewDoc = {
    _id: await nextReviewId(session, db, tracer),
    productId,
    userId: user._id,
    userName: user.name,
    rating: input.rating,
    title: input.title,
    body: input.body,
    helpfulVotes: 0,
    createdAt: new Date(),
  }
  await saveReview(review, eventId, scope, db, tracer)
  return review
}

export async function createReview(productId: number, input: CreateReviewRequest, tracer: Tracer) {
  const db = collections()
  const eventId = new ObjectId()
  const review = await writeTogether((scope) => addReview(productId, input, eventId, scope, db, tracer))
  return {
    review: {
      id: review._id,
      productId: review.productId,
      userId: review.userId,
      userName: review.userName,
      rating: review.rating,
      title: review.title,
      body: review.body,
      helpfulVotes: review.helpfulVotes,
      createdAt: review.createdAt.toISOString(),
    },
    eventId: eventId.toHexString(),
  }
}
