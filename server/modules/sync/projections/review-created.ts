import type { OutboxPayload } from '../../../../shared/types/domain'
import { int, writeCypher } from '../../../infrastructure/neo4j/client'
import type { Tracer } from '../../../infrastructure/trace'

const cypher = `
MATCH (user:User {id: $userId})
MATCH (product:Product {id: $productId})
MERGE (user)-[rating:RATED {reviewId: $reviewId}]->(product)
SET rating.rating = $rating,
    rating.at = datetime($at)
`

export function projectCreatedReview(payload: Extract<OutboxPayload, { type: 'review.created' }>, tracer?: Tracer) {
  const review = payload.review
  return writeCypher(
    cypher,
    {
      userId: int(review.userId),
      productId: int(review.productId),
      reviewId: int(review.id),
      rating: int(review.rating),
      at: review.at,
    },
    { tracer, operation: 'Project review' },
  )
}
