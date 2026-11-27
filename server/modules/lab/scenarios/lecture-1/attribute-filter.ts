import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { mongoEngine } from '../../engines/mongo'
import type { Scenario } from '../../types'

// Three EAV aliases express three independent predicates over the same product.
const SQL = `
SELECT p.id AS productId, p.name, b.name AS brand, p.price_cents AS priceCents
FROM product_attributes ram
JOIN attribute_definitions ramDef ON ramDef.id = ram.attribute_id AND ramDef.name = 'ram_gb'
JOIN products p ON p.id = ram.product_id
JOIN product_attributes color ON color.product_id = p.id
JOIN attribute_definitions colorDef ON colorDef.id = color.attribute_id AND colorDef.name = 'color'
JOIN product_attributes wifi ON wifi.product_id = p.id
JOIN attribute_definitions wifiDef ON wifiDef.id = wifi.attribute_id AND wifiDef.name = 'wifi6'
JOIN brands b ON b.id = p.brand_id
WHERE ram.value_number >= ?
  AND color.value_text = ?
  AND wifi.value_bool = 1
  AND p.category_id = ?
ORDER BY p.id`

// Attribute keys and values share one multikey index; $all keeps each $elemMatch on the same array element.
const pipeline = (ramGb: number, color: string) => [
  {
    $match: {
      categoryPath: DEMO.laptopCategoryId,
      attributes: {
        $all: [
          { $elemMatch: { k: 'ram_gb', v: { $gte: ramGb } } },
          { $elemMatch: { k: 'color', v: color } },
          { $elemMatch: { k: 'wifi6', v: true } },
        ],
      },
    },
  },
  { $project: { _id: 0, productId: '$_id', name: 1, brand: 1, priceCents: 1 } },
  { $sort: { productId: 1 } },
]

export const attributeFilter: Scenario = {
  id: 'attribute-filter',
  lecture: 1,
  order: 2,
  title: 'Filter several flexible attributes',
  question: 'Which laptops meet a memory, color and Wi-Fi requirement?',
  relationalPain: 'EAV turns each attribute condition into another indexed self-join.',
  nosqlWin: 'The attribute pattern keeps related key/value pairs together and supports same-element predicates.',
  talkingPoints: [
    'The MySQL query uses the attribute indexes and joins only matching products.',
    'MongoDB can match all required attribute elements in one document predicate.',
    'Category is part of the product index prefix and narrows this demo to laptops.',
  ],
  params: [
    { name: 'ramGb', label: 'Minimum RAM (GB)', type: 'number', default: 16, min: 8, max: 64 },
    { name: 'color', label: 'Color', type: 'string', default: 'black' },
  ],
  engines: [
    mysqlEngine({
      label: 'Three indexed EAV self joins',
      notes: [
        'Each alias has a different indexed attribute predicate.',
        'The product category and id are returned from the matching rows.',
      ],
      sql: SQL,
      values: (params) => [params.ramGb as number, params.color as string, DEMO.laptopCategoryId],
    }),
    mongoEngine({
      label: 'Attribute pattern with $all',
      notes: [
        'Each $elemMatch binds a key and its value to one array element.',
        'categoryPath is indexed and includes the laptop category.',
      ],
      collection: 'products',
      pipeline: (params) => pipeline(params.ramGb as number, params.color as string),
    }),
  ],
}
