import type { DriftCheck } from '../../../shared/types/api'
import { collections } from '../../infrastructure/mongo/client'
import { readCypher } from '../../infrastructure/neo4j/client'
import { shell, type Tracer } from '../../infrastructure/trace'

interface PairCount {
  _id: unknown
}

interface CountRow {
  count: number
}

interface GraphCountQuery {
  name: string
  cypher: string
}

interface GraphCount {
  name: string
  count: number
}

const pipelines = {
  purchases: [
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          orderId: '$_id',
          productId: '$items.productId',
        },
      },
    },
  ],
  ratings: [{ $group: { _id: '$_id' } }],
  views: [
    {
      $group: {
        _id: {
          userId: '$meta.userId',
          productId: '$meta.productId',
        },
      },
    },
  ],
  referrals: [
    { $match: { referredById: { $ne: null } } },
    {
      $group: {
        _id: {
          referrer: '$referredById',
          referred: '$_id',
        },
      },
    },
  ],
  stocks: [
    { $unwind: '$stock' },
    {
      $group: {
        _id: {
          warehouseId: '$_id',
          productId: '$stock.productId',
        },
      },
    },
  ],
}

async function countPairs(collectionName: keyof typeof pipelines, tracer: Tracer): Promise<number> {
  const pipeline = pipelines[collectionName]
  const work = () => {
    const db = collections()
    switch (collectionName) {
      case 'purchases':
        return db.orders.aggregate<PairCount>(pipeline).toArray()
      case 'ratings':
        return db.reviews.aggregate<PairCount>(pipeline).toArray()
      case 'views':
        return db.productViews.aggregate<PairCount>(pipeline).toArray()
      case 'referrals':
        return db.users.aggregate<PairCount>(pipeline).toArray()
      case 'stocks':
        return db.warehouses.aggregate<PairCount>(pipeline).toArray()
    }
  }
  const pairs = await tracer.run(
    'mongo',
    `Count ${collectionName} pairs`,
    shell(collectionName, 'aggregate', pipeline),
    work,
  )
  return pairs.length
}

const graphQueries: GraphCountQuery[] = [
  {
    name: 'users',
    cypher: `
MATCH (user:User)
RETURN count(user) AS count
`,
  },
  {
    name: 'products',
    cypher: `
MATCH (product:Product)
RETURN count(product) AS count
`,
  },
  {
    name: 'categories',
    cypher: `
MATCH (category:Category)
RETURN count(category) AS count
`,
  },
  {
    name: 'purchases',
    cypher: `
MATCH ()-[purchase:PURCHASED]->()
RETURN count(purchase) AS count
`,
  },
  {
    name: 'ratings',
    cypher: `
MATCH ()-[rating:RATED]->()
RETURN count(rating) AS count
`,
  },
  {
    name: 'views',
    cypher: `
MATCH ()-[view:VIEWED]->()
RETURN count(view) AS count
`,
  },
  {
    name: 'referrals',
    cypher: `
MATCH ()-[referral:REFERRED]->()
RETURN count(referral) AS count
`,
  },
  {
    name: 'stocks',
    cypher: `
MATCH ()-[stock:STOCKS]->()
RETURN count(stock) AS count
`,
  },
]

async function mongoProjectionCounts(tracer: Tracer) {
  const db = collections()
  const [users, products, categories] = await Promise.all([
    tracer.run('mongo', 'Count users', 'db.users.countDocuments()', () => db.users.countDocuments()),
    tracer.run('mongo', 'Count products', 'db.products.countDocuments()', () => db.products.countDocuments()),
    tracer.run('mongo', 'Count categories', 'db.categories.countDocuments()', () => db.categories.countDocuments()),
  ])
  const [purchases, ratings, views, referrals, stocks] = await Promise.all([
    countPairs('purchases', tracer),
    countPairs('ratings', tracer),
    countPairs('views', tracer),
    countPairs('referrals', tracer),
    countPairs('stocks', tracer),
  ])
  return { users, products, categories, purchases, ratings, views, referrals, stocks }
}

async function neo4jProjectionCounts(tracer: Tracer) {
  const graphRows: GraphCount[] = await Promise.all(
    graphQueries.map(async ({ name, cypher }) => {
      const [row] = await readCypher<CountRow>(cypher, {}, { tracer, operation: `Count graph ${name}` })
      return { name, count: row?.count ?? 0 }
    }),
  )
  return Object.fromEntries(graphRows.map(({ name, count }) => [name, count]))
}

export async function reconcileProjections(tracer: Tracer): Promise<DriftCheck[]> {
  const [mongoCounts, graphCounts] = await Promise.all([mongoProjectionCounts(tracer), neo4jProjectionCounts(tracer)])
  return Object.entries(mongoCounts).map(([name, mongoCount]) => {
    const neo4jCount = graphCounts[name] ?? 0
    return { name, mongoCount, neo4jCount, inSync: mongoCount === neo4jCount }
  })
}
