import type { EngineId } from '#shared/types/api'

/** What each feature does and what it replaced. Shown on demand beside the feature. */
export interface Insight {
  engine: Exclude<EngineId, 'mysql'>
  /** What the feature does for the person using it. */
  summary: string
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
    summary: 'Each suggested product names the people whose purchases led to it.',
    before:
      'Nested queries over follows, orders and order lines, then a second round of queries to find out who bought what.',
    now: 'One query starts at you, goes through the people you follow and ends at what they bought. The same path gives the names.',
    scenarioId: 'social-recommendations',
  },
  productPage: {
    engine: 'mongo',
    summary: 'A laptop and a book have different fields, and each is read as one document.',
    before: 'Eight tables, including a generic attribute table so that product types could have different fields.',
    now: 'Attributes, tags and the category path are stored inside the product. Reviews are read through one index.',
    scenarioId: 'product-page',
  },
  search: {
    engine: 'mongo',
    summary: 'The filters and their counts come from the products that match.',
    before: 'One self join for each selected attribute and a separate grouped query for each filter.',
    now: 'One aggregation pipeline returns the page, the total and the filter counts.',
    scenarioId: 'faceted-search',
  },
  socialProof: {
    engine: 'neo4j',
    summary: 'Shows which people you know bought this, and who connects you to them.',
    before:
      'Follows joined to itself, then to orders and order lines, with extra columns to remember who connects whom.',
    now: 'The query returns the path from you to each buyer, so the page can name the people on it.',
    scenarioId: 'friends-network',
  },
  alsoBought: {
    engine: 'neo4j',
    summary: 'Lists the products that buyers of this one also bought.',
    before: 'Order lines joined to orders, to orders again, and back to order lines.',
    now: 'One query goes from this product to its buyers and on to their other purchases.',
    scenarioId: 'also-bought',
  },
  checkout: {
    engine: 'mongo',
    summary: 'The order, the stock change and the notice for Neo4j are saved together.',
    before: 'Several tables in one transaction, and a separate job to tell other systems.',
    now: 'On a replica set, one transaction writes the order and an outbox event, and a change stream delivers it. On a single server the app writes them in turn, undoes them if a step fails, and checks the outbox every second.',
  },
  trust: {
    engine: 'neo4j',
    summary: 'Warns before payment when a card, device or address is shared with other accounts.',
    before: 'Self joins on orders for devices, again for cards and again for addresses.',
    now: 'Devices, cards and addresses are nodes. Accounts linked to the same node are connected.',
    scenarioId: 'fraud-rings',
  },
  delivery: {
    engine: 'neo4j',
    summary: 'Finds a warehouse that has the item and a route from it to the destination.',
    before: 'A recursive query that carries the list of visited stops as text.',
    now: 'Routes are relationships with a distance and a duration, added up along each path.',
    scenarioId: 'delivery-route',
  },
  orders: {
    engine: 'mongo',
    summary: 'Past orders keep the item names and prices from the day of purchase.',
    before: 'Joins to order lines, with care to keep old prices when a product changes.',
    now: 'Each order is one document with a copy of its items.',
    scenarioId: 'order-history',
  },
  people: {
    engine: 'neo4j',
    summary: 'Ranks suggestions by shared connections and shared purchases.',
    before: 'The list of people you follow repeated as a subquery several times.',
    now: 'Two steps from you give both the candidates and the people you have in common.',
    scenarioId: 'people-you-may-know',
  },
  connection: {
    engine: 'neo4j',
    summary: 'Finds the shortest chain of follows between two people.',
    before: 'A recursive query that expands every level up to the limit.',
    now: 'Neo4j searches outward and stops at the first shortest path.',
    scenarioId: 'shortest-path',
  },
  referrals: {
    engine: 'neo4j',
    summary: 'Counts the people you referred at each level and what they bought.',
    before: 'A recursive query that records its path so that a loop cannot run forever.',
    now: 'The query follows referrals to any depth. A path never uses the same relationship twice.',
    scenarioId: 'referral-chain',
  },
  analytics: {
    engine: 'mongo',
    summary: 'Sales figures are calculated from the order documents.',
    before: 'Grouped queries joining orders, order lines, products and categories.',
    now: 'Aggregation pipelines read the orders. MySQL is faster at these reports; MongoDB saves keeping a second copy.',
    scenarioId: 'monthly-revenue',
  },
} as const satisfies Record<string, Insight>

export type InsightId = keyof typeof INSIGHTS
