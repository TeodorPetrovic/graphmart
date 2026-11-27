import type { ProductDoc, Route, Warehouse } from '../../shared/types/domain'
import { warehousePlaces } from './reference-data'
import { type RandomSource } from './random'

export interface LogisticsData {
  warehouses: Warehouse[]
  routes: Route[]
}

export function generateLogistics(products: ProductDoc[], random: RandomSource): LogisticsData {
  const warehouses: Warehouse[] = warehousePlaces.map(([city, _country, lat, lng], index) => ({
    _id: index + 1,
    name: `${city} Fulfilment Centre`,
    city,
    lat,
    lng,
    stock: [],
  }))

  // This network keeps the shortest distance route longer than the fewest-hop route for the demo.
  const links: [number, number, number, number][] = [
    [1, 2, 90, 180],
    [2, 3, 460, 450],
    [3, 4, 140, 160],
    [4, 5, 380, 370],
    [5, 6, 215, 230],
    [6, 7, 440, 420],
    [7, 8, 150, 170],
    [8, 9, 600, 560],
    [9, 10, 850, 780],
    [10, 11, 850, 780],
    [11, 12, 510, 490],
    [2, 5, 580, 440],
    [5, 9, 710, 520],
    [9, 12, 1000, 900],
    [3, 8, 930, 680],
    [3, 12, 3000, 2000],
    [4, 9, 870, 650],
    [6, 10, 760, 540],
    [7, 12, 1220, 900],
  ]
  const routes = links.flatMap(([fromId, toId, distanceKm, durationMin]) => [
    { fromId, toId, distanceKm, durationMin },
    { fromId: toId, toId: fromId, distanceKm, durationMin },
  ])

  for (const product of products) {
    const count = 1 + Math.floor(random.next() * 4)
    const warehouseIds = new Set<number>([1 + Math.floor(random.next() * warehouses.length)])
    while (warehouseIds.size < count) warehouseIds.add(1 + Math.floor(random.next() * warehouses.length))
    if (product._id === 1) warehouseIds.delete(1)
    if (warehouseIds.size === 0) warehouseIds.add(2)
    for (const warehouseId of warehouseIds) {
      warehouses[warehouseId - 1]!.stock.push({ productId: product._id, quantity: 1 + Math.floor(random.next() * 100) })
    }
  }

  return { warehouses, routes }
}
