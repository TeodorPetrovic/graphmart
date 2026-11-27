import type {
  Address,
  CategoryDoc,
  Follow,
  OrderDoc,
  ProductDoc,
  ProductViewDoc,
  ReviewDoc,
  Route,
  UserDoc,
  Warehouse,
} from '../../shared/types/domain'
import { SCALES, type ScaleName } from '../../shared/utils/demo'
import { generateCatalog } from './catalog'
import { generateCommerce } from './commerce'
import { generateLogistics } from './logistics'
import { createRandom } from './random'
import { generateFollows } from './social'
import { generateUsers } from './users'
import { brands, interests, tagPool } from './reference-data'

export interface Dataset {
  users: UserDoc[]
  categories: CategoryDoc[]
  products: ProductDoc[]
  orders: OrderDoc[]
  reviews: ReviewDoc[]
  views: ProductViewDoc[]
  follows: Follow[]
  warehouses: Warehouse[]
  routes: Route[]
  brands: string[]
  tags: string[]
}

/** Build one deterministic dataset from focused generators for each domain area. */
export function generateDataset(scale: ScaleName): Dataset {
  const sizes = SCALES[scale]
  const random = createRandom()
  const userData = generateUsers(sizes.users, random)
  const catalog = generateCatalog(sizes.products, random)
  const commerce = generateCommerce(sizes, userData.users, userData.addresses, catalog.products, random)
  const logistics = generateLogistics(catalog.products, random)

  return {
    users: userData.users,
    categories: catalog.categories,
    products: catalog.products,
    orders: commerce.orders,
    reviews: commerce.reviews,
    views: commerce.views,
    follows: generateFollows(userData.users, sizes.avgFollows, random),
    warehouses: logistics.warehouses,
    routes: logistics.routes,
    brands: [...brands],
    tags: [...new Set([...tagPool, ...interests, 'smart-home'])],
  }
}
