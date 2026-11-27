import { ObjectId, type ClientSession } from 'mongodb'
import type { CreateReviewRequest } from '../../../shared/types/api'
import type { OutboxDoc, ReviewDoc } from '../../../shared/types/domain'
import { collections, mongoClient } from '../../infrastructure/mongo/client'
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

function ratingUpdatePipeline(rating: number) {
  return [
    {
      $set: {
        'ratingSummary.count': { $add: ['$ratingSummary.count', 1] },
        'ratingSummary.sum': { $add: ['$ratingSummary.sum', rating] },
        'ratingSummary.avg': {
          $divide: [{ $add: ['$ratingSummary.sum', rating] }, { $add: ['$ratingSummary.count', 1] }],
        },
      },
    },
  ]
}

async function nextReviewId(session: ClientSession, db: CommerceCollections, tracer: Tracer): Promise<number> {
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
  session: ClientSession,
  db: CommerceCollections,
  tracer: Tracer,
): Promise<void> {
  await tracer.run('mongo', 'Insert review', shell('reviews', 'insertOne', review), () =>
    db.reviews.insertOne(review, { session }),
  )
  const summaryFilter = { _id: review.productId }
  const summaryPipeline = ratingUpdatePipeline(review.rating)
  await tracer.run(
    'mongo',
    'Update product rating summary atomically',
    shell('products', 'updateOne', summaryFilter, summaryPipeline),
    () => db.products.updateOne(summaryFilter, summaryPipeline, { session }),
  )
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

async function createReviewInTransaction(
  productId: number,
  input: CreateReviewRequest,
  eventId: ObjectId,
  session: ClientSession,
  db: CommerceCollections,
  tracer: Tracer,
): Promise<ReviewDoc> {
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
  await saveReview(review, eventId, session, db, tracer)
  return review
}

export async function createReview(productId: number, input: CreateReviewRequest, tracer: Tracer) {
  const db = collections()
  const session = mongoClient().startSession()
  const eventId = new ObjectId()
  let review: ReviewDoc | undefined
  try {
    // The review, rating summary, counter, and outbox event commit as one document transaction.
    review = await session.withTransaction(() =>
      createReviewInTransaction(productId, input, eventId, session, db, tracer),
    )
  } finally {
    await session.endSession()
  }
  if (!review) throw new Error('Review transaction completed without a review')
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
