import { DEMO } from '../../../../../shared/utils/demo'
import { mongoEngine } from '../../engines/mongo'
import { mysqlEngine } from '../../engines/mysql'
import type { Scenario } from '../../types'

// One product page needs six tables. Each one-to-many relation is an inner (correlated) query,
// because joining them all at once would multiply attributes x tags x reviews.
const SQL = `
SELECT p.id          AS productId,
       p.name        AS name,
       b.name        AS brand,
       c.name        AS category,
       p.price_cents AS priceCents,
       -- inner query 1: Entity-Attribute-Value rows folded back into one object
       (SELECT GROUP_CONCAT(
                 CONCAT(d.name, '=', COALESCE(
                   a.value_text,
                   CAST(CAST(a.value_number AS SIGNED) AS CHAR),
                   IF(a.value_bool = 1, 'true', 'false')))
                 ORDER BY d.name SEPARATOR ', ')
          FROM product_attributes a
          JOIN attribute_definitions d ON d.id = a.attribute_id
         WHERE a.product_id = p.id) AS attributes,
       -- inner query 2: many-to-many through a link table
       (SELECT GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ')
          FROM product_tags pt
          JOIN tags t ON t.id = pt.tag_id
         WHERE pt.product_id = p.id) AS tags,
       -- inner query 3: the five newest reviews with their authors
       (SELECT GROUP_CONCAT(CONCAT(recent.name, ' (', recent.rating, ')')
                 ORDER BY recent.created_at DESC, recent.id DESC SEPARATOR ', ')
          FROM (SELECT r.id, r.rating, r.created_at, u.name
                  FROM reviews r
                  JOIN users u ON u.id = r.user_id
                 WHERE r.product_id = ?
                 ORDER BY r.created_at DESC, r.id DESC
                 LIMIT 5) AS recent) AS latestReviews
FROM products p
JOIN brands b     ON b.id = p.brand_id
JOIN categories c ON c.id = p.category_id
WHERE p.id = ?`

/** Joins an array expression into "a, b, c", the shape GROUP_CONCAT produces. */
const joined = (items: object) => ({
  $reduce: {
    input: items,
    initialValue: '',
    in: { $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ', '] }, '$$this'] },
  },
})

// Attributes, tags and brand already live inside the product document.
// Only the reviews (unbounded, so not embedded) and the category name are looked up.
const pipeline = (productId: number) => [
  { $match: { _id: productId } },
  { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
  {
    $lookup: {
      from: 'reviews',
      localField: '_id',
      foreignField: 'productId',
      pipeline: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 5 }],
      as: 'reviews',
    },
  },
  {
    $project: {
      _id: 0,
      productId: '$_id',
      name: 1,
      brand: 1,
      category: { $first: '$category.name' },
      priceCents: 1,
      attributes: joined({
        $map: {
          input: { $sortArray: { input: '$attributes', sortBy: { k: 1 } } },
          in: { $concat: ['$$this.k', '=', { $toString: '$$this.v' }] },
        },
      }),
      tags: joined({ $sortArray: { input: '$tags', sortBy: 1 } }),
      latestReviews: joined({
        $map: {
          input: '$reviews',
          in: { $concat: ['$$this.userName', ' (', { $toString: '$$this.rating' }, ')'] },
        },
      }),
    },
  },
]

export const productPage: Scenario = {
  id: 'product-page',
  lecture: 1,
  order: 1,
  title: 'One product page',
  question: 'Everything the product page shows: product, brand, category, attributes, tags and the 5 newest reviews.',
  relationalPain:
    'The data is spread over eight tables. Attributes need the Entity-Attribute-Value workaround and every one-to-many relation becomes its own inner query.',
  nosqlWin:
    'The product document already contains its brand, attributes and tags. Only category and reviews need an indexed lookup.',
  talkingPoints: [
    'Embed what is read together and stays small; reference what grows without bound, like reviews.',
    'Review documents carry the author name, so no join to users is needed. The price is that a rename must update them.',
    'For one product both databases use indexes, so expect similar times. The difference is the shape of the code.',
  ],
  params: [{ name: 'productId', label: 'Product id', type: 'number', default: DEMO.productId, min: 1 }],
  engines: [
    mysqlEngine({
      label: '3 joins + 3 inner queries over 8 tables',
      notes: ['EAV values live in three typed columns, so reading one attribute needs COALESCE.'],
      sql: SQL,
      values: (params) => [params.productId as number, params.productId as number],
    }),
    mongoEngine({
      label: 'One document + 2 indexed lookups',
      notes: ['The $match uses _id; the review lookup uses the { productId, createdAt } index.'],
      collection: 'products',
      pipeline: (params) => pipeline(params.productId as number),
    }),
  ],
}
