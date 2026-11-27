import type { EngineId } from '#shared/types/api'

/** The plain language story behind each feature, shown on demand next to it. */
export interface Insight {
  engine: Exclude<EngineId, 'mysql'>
  /** One sentence a shopper or a student understands. */
  benefit: string
  /** What the old table based application needed. */
  before: string
  /** What happens now. */
  now: string
  /** Performance lab scenario that measures the same kind of question. */
  scenarioId?: string
}

export const INSIGHTS = {
  forYou: {
    engine: 'neo4j',
    benefit: 'Suggestions explain themselves: you can see which people led to each product.',
    before: 'Nested queries over follows, orders and order lines, plus a second round to find out why.',
    now: 'One walk from you, through the people you follow, to what they bought. The walk is also the explanation.',
    scenarioId: 'social-recommendations',
  },
  productPage: {
    engine: 'mongo',
    benefit: 'A laptop and a book have different details, and each arrives as one complete product.',
    before: 'Eight tables, with a generic attribute table so different kinds of product could have different fields.',
    now: 'Attributes, tags and the category path are stored inside the product. Reviews come from one index.',
    scenarioId: 'product-page',
  },
  search: {
    engine: 'mongo',
    benefit: 'Filters and their counts adapt to whatever the matching products have.',
    before: 'One self join per selected attribute and a separate grouped query for every filter box.',
    now: 'One pipeline returns the page, the total and every filter count together.',
    scenarioId: 'faceted-search',
  },
  socialProof: {
    engine: 'neo4j',
    benefit: 'See who you know that bought this, and through whom you know them.',
    before: 'Join follows to itself, then to orders and order lines, and keep track of who connects whom.',
    now: 'The path from you to each buyer is the answer, so the shop can show it.',
    scenarioId: 'friends-network',
  },
  alsoBought: {
    engine: 'neo4j',
    benefit: 'Suggestions come from what buyers of this product really bought next to it.',
    before: 'Order lines joined to orders, joined to orders again, then to order lines again.',
    now: 'One walk: this product, the people who bought it, the other things they bought.',
    scenarioId: 'also-bought',
  },
  checkout: {
    engine: 'mongo',
    benefit: 'Stock, order and notification change together, or not at all.',
    before: 'Several tables in one transaction, plus a separate job to tell other systems.',
    now: 'One transaction writes the order document and an event. A change stream delivers it to the graph.',
  },
  trust: {
    engine: 'neo4j',
    benefit: 'The shop notices before payment that a card or device is shared with other accounts.',
    before: 'Self joins on orders for devices, again for cards and again for addresses.',
    now: 'Devices, cards and addresses are points in the graph. Accounts touching the same point are connected.',
    scenarioId: 'fraud-rings',
  },
  delivery: {
    engine: 'neo4j',
    benefit: 'Each parcel gets a real route from a warehouse that has the item.',
    before: 'A recursive query that carries the visited stops along as text.',
    now: 'Routes are connections with distance and duration, added up along each path.',
    scenarioId: 'delivery-route',
  },
  orders: {
    engine: 'mongo',
    benefit: 'Your history shows exactly what you bought, at the price you paid.',
    before: 'Joins to order lines, and care to keep old prices when products change.',
    now: 'Each order is one document with a snapshot of its items.',
    scenarioId: 'order-history',
  },
  people: {
    engine: 'neo4j',
    benefit: 'People you may know are ranked by who connects you and what you both bought.',
    before: 'The question "whom do I follow" repeated as an inner query several times.',
    now: 'Two steps along your connections give the candidates and the mutual friends at once.',
    scenarioId: 'people-you-may-know',
  },
  connection: {
    engine: 'neo4j',
    benefit: 'Find how any two people are connected, even several steps apart.',
    before: 'A recursive query that expands every level up to the limit.',
    now: 'The database searches the connections and stops at the first shortest route.',
    scenarioId: 'shortest-path',
  },
  referrals: {
    engine: 'neo4j',
    benefit: 'See everyone you brought in, level by level, and what they bought.',
    before: 'A recursive query that must remember its path so that a loop cannot run forever.',
    now: 'Follow referrals as many levels as needed. One path never uses the same connection twice.',
    scenarioId: 'referral-chain',
  },
  analytics: {
    engine: 'mongo',
    benefit: 'The store report is computed directly from the order documents.',
    before: 'Grouped queries joining orders, lines, products and categories.',
    now: 'Aggregation pipelines read the orders. This is not faster than SQL; it keeps one place to read from.',
    scenarioId: 'monthly-revenue',
  },
} as const satisfies Record<string, Insight>

export type InsightId = keyof typeof INSIGHTS
