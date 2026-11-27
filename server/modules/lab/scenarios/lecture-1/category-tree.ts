import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import { neo4jEngine } from '../../engines/neo4j'
import { int } from '../../../../infrastructure/neo4j/client'
import type { Scenario } from '../../types'

// The recursive CTE carries a relative depth alongside each category id.
const SQL = `
WITH RECURSIVE subtree AS (
  SELECT id, parent_id, name, 0 AS depth
  FROM categories
  WHERE id = ?
  UNION ALL
  SELECT child.id, child.parent_id, child.name, parent.depth + 1
  FROM categories child
  JOIN subtree parent ON child.parent_id = parent.id
)
SELECT subtree.id AS categoryId, subtree.depth, subtree.name,
       COUNT(p.id) AS productCount, MIN(p.price_cents) AS minPriceCents
FROM subtree
LEFT JOIN products p ON p.category_id = subtree.id
GROUP BY subtree.id, subtree.depth, subtree.name
ORDER BY subtree.depth, subtree.id`

// The stored parent links let $graphLookup expand just the selected category's descendants.
const pipeline = (categoryId: number) => [
  { $match: { _id: categoryId } },
  {
    $graphLookup: {
      from: 'categories',
      startWith: '$_id',
      connectFromField: '_id',
      connectToField: 'parentId',
      depthField: 'treeDepth',
      as: 'descendants',
    },
  },
  {
    $project: {
      rows: {
        $concatArrays: [
          [{ _id: '$_id', name: '$name', depth: 0 }],
          {
            $map: {
              input: '$descendants',
              as: 'category',
              in: {
                _id: '$$category._id',
                name: '$$category.name',
                depth: { $add: ['$$category.treeDepth', 1] },
              },
            },
          },
        ],
      },
    },
  },
  { $unwind: '$rows' },
  {
    // Aggregate inside the lookup so only one summary per category leaves the products collection.
    $lookup: {
      from: 'products',
      localField: 'rows._id',
      foreignField: 'categoryId',
      pipeline: [{ $group: { _id: null, count: { $sum: 1 }, minPriceCents: { $min: '$priceCents' } } }],
      as: 'summary',
    },
  },
  {
    $project: {
      _id: 0,
      categoryId: '$rows._id',
      depth: '$rows.depth',
      name: '$rows.name',
      productCount: { $ifNull: [{ $first: '$summary.count' }, 0] },
      minPriceCents: { $ifNull: [{ $first: '$summary.minPriceCents' }, null] },
    },
  },
  { $sort: { depth: 1, categoryId: 1 } },
]

// Neo4j follows child-to-parent edges backwards, including the selected category at depth zero.
const CYPHER = `
MATCH (root:Category {id: $categoryId})
MATCH path = (category:Category)-[:SUBCATEGORY_OF*0..]->(root)
WITH category, length(path) AS depth
OPTIONAL MATCH (product:Product)-[:IN_CATEGORY]->(category)
RETURN category.id AS categoryId,
       depth,
       category.name AS name,
       count(product) AS productCount,
       min(product.priceCents) AS minPriceCents
ORDER BY depth, categoryId`

export const categoryTree: Scenario = {
  id: 'category-tree',
  lecture: 1,
  order: 8,
  title: 'Walk a category subtree',
  question: 'For each category below this node, how deep is it and what products does it contain?',
  relationalPain: 'MySQL recursively follows parent ids and aggregates each category’s directly assigned products.',
  nosqlWin: 'MongoDB can traverse parent references with $graphLookup; Neo4j follows explicit category relationships.',
  talkingPoints: [
    'All engines report depth relative to the chosen category.',
    'Counts and minimum prices are for directly assigned products at each category.',
    'Neo4j stores the child-to-parent relationship, so the traversal walks towards the root.',
  ],
  params: [{ name: 'categoryId', label: 'Category id', type: 'number', default: DEMO.rootCategoryId, min: 1 }],
  engines: [
    mysqlEngine({
      label: 'Recursive CTE',
      notes: [
        'The anchor is the requested category.',
        'The recursive term visits children and the final aggregate remains per category.',
      ],
      sql: SQL,
      values: (params) => [params.categoryId as number],
    }),
    mongoEngine({
      label: '$graphLookup + product lookup',
      notes: ['The graph lookup starts from the category id.', 'Products are looked up by their direct category id.'],
      collection: 'categories',
      pipeline: (params) => pipeline(params.categoryId as number),
    }),
    neo4jEngine({
      label: 'SUBCATEGORY_OF*0..',
      notes: [
        'Neo4j traverses stored relationships rather than joining parent ids.',
        'Zero hops includes the selected category itself.',
      ],
      cypher: CYPHER,
      params: (params) => ({ categoryId: int(params.categoryId as number) }),
    }),
  ],
}
