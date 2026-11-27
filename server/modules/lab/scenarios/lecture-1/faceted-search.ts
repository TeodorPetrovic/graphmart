import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import type { Scenario } from '../../types'

// The recursive CTE resolves a subtree once; independent facet GROUP BYs then combine with UNION ALL.
const SQL = `
WITH RECURSIVE subtree AS (
  SELECT id FROM categories WHERE id = ?
  UNION ALL
  SELECT child.id
  FROM categories child
  JOIN subtree parent ON child.parent_id = parent.id
)
SELECT 'brand' AS facet, b.name COLLATE utf8mb4_0900_ai_ci AS value, COUNT(*) AS count
FROM products p
JOIN subtree s ON s.id = p.category_id
JOIN brands b ON b.id = p.brand_id
GROUP BY b.name
UNION ALL
SELECT 'priceBand',
       CASE WHEN p.price_cents < 5000 THEN 'under-50'
            WHEN p.price_cents < 20000 THEN '50-200'
            ELSE '200-plus' END COLLATE utf8mb4_0900_ai_ci AS band,
       COUNT(*)
FROM products p
JOIN subtree s ON s.id = p.category_id
GROUP BY band
UNION ALL
SELECT 'warranty_years', CAST(CAST(pa.value_number AS SIGNED) AS CHAR) COLLATE utf8mb4_0900_ai_ci, COUNT(*)
FROM products p
JOIN subtree s ON s.id = p.category_id
JOIN product_attributes pa ON pa.product_id = p.id
JOIN attribute_definitions ad ON ad.id = pa.attribute_id AND ad.name = 'warranty_years'
GROUP BY pa.value_number
ORDER BY facet, value`

// categoryPath makes subtree selection a single indexed membership match before $facet fans out.
const pipeline = (categoryId: number) => [
  { $match: { categoryPath: categoryId } },
  {
    $facet: {
      brands: [
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $project: { _id: 0, facet: { $literal: 'brand' }, value: '$_id', count: 1 } },
      ],
      priceBands: [
        {
          $bucket: {
            groupBy: '$priceCents',
            boundaries: [0, 5000, 20000, 2147483647],
            default: '200-plus',
            output: { count: { $sum: 1 } },
          },
        },
        {
          $project: {
            _id: 0,
            facet: { $literal: 'priceBand' },
            value: {
              $switch: {
                branches: [
                  { case: { $lt: ['$_id', 5000] }, then: 'under-50' },
                  { case: { $lt: ['$_id', 20000] }, then: '50-200' },
                ],
                default: '200-plus',
              },
            },
            count: 1,
          },
        },
      ],
      warranties: [
        { $unwind: '$attributes' },
        { $match: { 'attributes.k': 'warranty_years' } },
        { $group: { _id: '$attributes.v', count: { $sum: 1 } } },
        { $project: { _id: 0, facet: { $literal: 'warranty_years' }, value: { $toString: '$_id' }, count: 1 } },
      ],
    },
  },
  { $project: { rows: { $concatArrays: ['$brands', '$priceBands', '$warranties'] } } },
  { $unwind: '$rows' },
  { $replaceRoot: { newRoot: '$rows' } },
  { $sort: { facet: 1, value: 1 } },
]

export const facetedSearch: Scenario = {
  id: 'faceted-search',
  lecture: 1,
  order: 4,
  title: 'Compute search facets',
  question: 'Which brands, price bands and warranty values appear in a category subtree?',
  relationalPain: 'The legacy schema runs separate grouped passes and first resolves the recursive category tree.',
  nosqlWin:
    'A materialised categoryPath selects the subtree once, then one aggregation fans out into independent facets.',
  talkingPoints: [
    'Each facet still scans the matching product working set.',
    'The materialised path shifts work to writes to make subtree reads direct.',
    'UNION ALL preserves separate facet groups without a global product scan.',
  ],
  params: [{ name: 'categoryId', label: 'Category id', type: 'number', default: DEMO.rootCategoryId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Recursive subtree + grouped passes',
      notes: [
        'The recursive CTE anchors on the selected category.',
        'All groups are restricted to subtree product ids.',
      ],
      sql: SQL,
      values: (params) => [params.categoryId as number],
    }),
    mongoEngine({
      label: 'Indexed subtree + $facet',
      notes: [
        'categoryPath contains the category and its ancestors.',
        '$facet shares the filtered input among three aggregations.',
      ],
      collection: 'products',
      pipeline: (params) => pipeline(params.categoryId as number),
    }),
  ],
}
