import { DEMO } from '../../shared/utils/demo'
import type { CategoryDoc, ProductAttribute, ProductDoc } from '../../shared/types/domain'
import { brands, categoryDefinitions, tagPool } from './reference-data'
import { dateBeforeAnchor, pick, type RandomSource } from './random'

export interface CatalogData {
  categories: CategoryDoc[]
  products: ProductDoc[]
}

const familyByCategory: Record<number, string> = {
  3: 'technology',
  4: 'technology',
  6: 'technology',
  9: 'technology',
  11: 'technology',
  12: 'technology',
  14: 'music',
  15: 'music',
  17: 'photography',
  18: 'photography',
  20: 'gaming',
  21: 'gaming',
  23: 'technology',
  24: 'technology',
  27: 'smart-home',
  28: 'smart-home',
  30: 'cooking',
  32: 'smart-home',
  35: 'education',
  37: 'music',
  39: 'education',
  40: 'design',
  41: 'technology',
  42: 'technology',
  44: 'technology',
  46: 'fitness',
  47: 'fitness',
  49: 'photography',
  51: 'technology',
}

export function generateCatalog(count: number, random: RandomSource): CatalogData {
  const categories = buildCategories()
  const leaves = categories.filter((category) => !categories.some((child) => child.parentId === category._id))
  const products: ProductDoc[] = []

  for (let id = 1; id <= count; id += 1) {
    // One in eight products belongs to laptops, keeping the demo family visible at every scale.
    const category =
      id === 1 || id % 8 === 0
        ? categories.find((row) => row._id === DEMO.laptopCategoryId)!
        : pick(
            random,
            leaves.filter((row) => row._id !== DEMO.laptopCategoryId),
          )
    const brand = id === 1 ? 'Aster' : pick(random, brands)
    const family = category.name.replace(/s$/, '')
    const attributes = attributesFor(category._id, random)
    const productFamily = familyByCategory[category._id] ?? 'technology'
    const name =
      id === 1
        ? 'Aster Pro 14 Laptop'
        : `${brand} ${pick(random, ['Pro', 'Studio', 'Everyday', 'Compact', 'Plus'])} ${family} ${100 + (id % 900)}`

    products.push({
      _id: id,
      sku: `GM-${String(id).padStart(6, '0')}`,
      name,
      description: `Thoughtfully designed ${family.toLowerCase()} by ${brand}, made for ${productFamily} fans and everyday use.`,
      categoryId: category._id,
      categoryPath: [...category.ancestors, category._id],
      brand,
      priceCents: id === 1 ? 129_900 : 2_499 + Math.floor(Math.pow(random.next(), 1.8) * 247_500),
      stock: Math.floor(random.next() * 120),
      attributes,
      tags: [...new Set([productFamily, pick(random, tagPool), pick(random, tagPool)])],
      ratingSummary: { avg: 0, count: 0, sum: 0 },
      createdAt: dateBeforeAnchor(random),
    })
  }

  return { categories, products }
}

export function productFamily(product: ProductDoc): string {
  return familyByCategory[product.categoryId] ?? 'technology'
}

function buildCategories(): CategoryDoc[] {
  const definitions = new Map(categoryDefinitions.map((definition) => [definition.id, definition]))
  return categoryDefinitions.map((definition) => {
    const parent = definition.parentId === null ? null : definitions.get(definition.parentId)!
    const ancestors: number[] = []
    let current = parent
    while (current) {
      ancestors.unshift(current.id)
      current = current.parentId === null ? null : definitions.get(current.parentId)!
    }
    return {
      _id: definition.id,
      name: definition.name,
      parentId: definition.parentId,
      ancestors,
      depth: ancestors.length,
    }
  })
}

function attributesFor(categoryId: number, random: RandomSource): ProductAttribute[] {
  if (categoryId === DEMO.laptopCategoryId) {
    return [
      { k: 'ram_gb', v: pick(random, [8, 16, 32, 64]) },
      { k: 'storage_gb', v: pick(random, [256, 512, 1024, 2048]) },
      { k: 'color', v: pick(random, ['black', 'silver', 'blue']) },
      { k: 'wifi6', v: random.next() < 0.72 },
    ]
  }

  if ([14, 15, 21, 23, 24, 27, 41, 42, 46, 47, 51].includes(categoryId)) {
    return [
      { k: 'wireless', v: random.next() < 0.65 },
      { k: 'warranty_years', v: pick(random, [1, 2, 3]) },
      { k: 'color', v: pick(random, ['black', 'white', 'silver']) },
    ]
  }

  return [
    { k: 'warranty_years', v: pick(random, [1, 2, 3]) },
    { k: 'capacity_gb', v: pick(random, [128, 256, 512, 1024]) },
  ]
}
