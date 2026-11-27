import type { Scenario } from '../../types'
import { attributeFilter } from './attribute-filter'
import { categoryTree } from './category-tree'
import { facetedSearch } from './faceted-search'
import { indexImpact } from './index-impact'
import { monthlyRevenue } from './monthly-revenue'
import { orderHistory } from './order-history'
import { productPage } from './product-page'
import { topSpenders } from './top-spenders'

export const lectureOne: Scenario[] = [
  productPage,
  attributeFilter,
  orderHistory,
  facetedSearch,
  monthlyRevenue,
  topSpenders,
  indexImpact,
  categoryTree,
]
