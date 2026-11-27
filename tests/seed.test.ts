import { describe, expect, test } from 'bun:test'
import { generateDataset } from '../scripts/seed/generate'

describe('seed generator', () => {
  test('is deterministic for a scale', () => {
    const first = generateDataset('small')
    const second = generateDataset('small')

    expect(first.users.slice(0, 10)).toEqual(second.users.slice(0, 10))
    expect(first.products.slice(0, 10)).toEqual(second.products.slice(0, 10))
    expect(first.orders.slice(0, 10)).toEqual(second.orders.slice(0, 10))
    expect(first.views.slice(0, 10)).toEqual(second.views.slice(0, 10))
    expect(first.follows).toEqual(second.follows)
  })

  test('has a long-tail product distribution and a reachable social network', () => {
    const dataset = generateDataset('small')
    const unitsByProduct = new Map<number, number>()
    for (const order of dataset.orders) {
      for (const item of order.items) {
        unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) ?? 0) + item.quantity)
      }
    }
    const orderedUnitCount = [...unitsByProduct.values()].reduce((total, count) => total + count, 0)
    const topProductShare = Math.max(...unitsByProduct.values()) / orderedUnitCount
    const reach = followsByDepth(dataset.follows, 1)
    const secondHop = [...reach.values()].filter((depth) => depth === 2).length
    const thirdHop = [...reach.values()].filter((depth) => depth === 3).length
    const sharedTasteFollows = dataset.follows.filter((follow) => {
      const follower = dataset.users[follow.followerId - 1]!
      const followee = dataset.users[follow.followeeId - 1]!
      return follower.interests.some((interest) => followee.interests.includes(interest))
    })

    expect(topProductShare).toBeGreaterThan(0.02)
    expect(topProductShare).toBeLessThan(0.15)
    expect(dataset.products.length).toBeGreaterThan(0)
    expect(secondHop).toBeGreaterThanOrEqual(100)
    expect(thirdHop).toBeGreaterThanOrEqual(500)
    expect(sharedTasteFollows.length / dataset.follows.length).toBeGreaterThan(0.4)
    expect(reach.get(50)).toBe(4)
    expect(dataset.follows.filter((follow) => follow.followeeId === 50)).toHaveLength(1)
    expect(dataset.follows.filter((follow) => follow.followerId === 1).length).toBeGreaterThanOrEqual(25)
  })

  test('keeps planted domain facts and generated references consistent', () => {
    const dataset = generateDataset('small')
    const categories = new Map(dataset.categories.map((category) => [category._id, category]))
    const users = new Map(dataset.users.map((user) => [user._id, user]))
    expect(categories.get(1)?.name).toBe('Electronics')
    expect(categories.get(2)?.parentId).toBe(1)
    expect(categories.get(3)?.name).toBe('Laptops')
    expect(categories.get(3)?.parentId).toBe(2)
    expect(Math.max(...dataset.categories.map((category) => category.depth))).toBeGreaterThanOrEqual(4)
    expect(dataset.categories.filter((category) => category.parentId === null).length).toBeGreaterThanOrEqual(3)
    expect(
      dataset.products.filter((product) => product.categoryId === 3).length / dataset.products.length,
    ).toBeGreaterThanOrEqual(0.05)
    expect(dataset.products[0]?.brand).toBe('Aster')
    expect(dataset.products[0]?.name).toContain('Aster')
    expect(dataset.products[0]?.categoryId).toBe(3)
    expect(dataset.products[0]?.attributes.map((attribute) => attribute.k)).toEqual([
      'ram_gb',
      'storage_gb',
      'color',
      'wifi6',
    ])

    expect(dataset.orders.filter((order) => order.userId === 1).length).toBeGreaterThanOrEqual(10)
    expect(dataset.views.filter((view) => view.meta.userId === 1).length).toBeGreaterThanOrEqual(25)
    expect(dataset.reviews.filter((review) => review.userId === 1).length).toBeGreaterThanOrEqual(25)
    expect(
      dataset.orders.every((order) => order.items.length === new Set(order.items.map((item) => item.productId)).size),
    ).toBe(true)
    expect(dataset.orders.every((order) => order.createdAt >= users.get(order.userId)!.createdAt)).toBe(true)
    expect(
      dataset.orders.every(
        (order) => order.totalCents === order.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
      ),
    ).toBe(true)
    expect(
      dataset.orders.every((order) => order.payment.method === 'card' || order.payment.cardFingerprint === null),
    ).toBe(true)
    expect(
      dataset.orders.every((order) =>
        users.get(order.userId)!.addresses.some((address) => sameAddress(address, order.shippingAddress)),
      ),
    ).toBe(true)
    expect(
      dataset.products.every(
        (product) =>
          product.ratingSummary.avg ===
          (product.ratingSummary.count
            ? Math.round((product.ratingSummary.sum / product.ratingSummary.count) * 100) / 100
            : 0),
      ),
    ).toBe(true)
    expect(dataset.reviews.filter((review) => review.rating >= 4).length / dataset.reviews.length).toBeGreaterThan(0.7)

    const ringOrders = dataset.orders.filter((order) => order.userId >= 101 && order.userId <= 106)
    expect(new Set(ringOrders.map((order) => order.deviceId)).size).toBe(1)
    expect(new Set(ringOrders.map((order) => order.payment.cardFingerprint).filter(Boolean)).size).toBe(1)
    expect(new Set(ringOrders.map((order) => addressIdentity(order.shippingAddress))).size).toBe(1)
    expect(dataset.orders.find((order) => order._id === 13)?.deviceId).toBe(
      dataset.orders.find((order) => order._id === 14)?.deviceId,
    )

    expect(dataset.warehouses).toHaveLength(12)
    expect(dataset.warehouses.every((warehouse) => warehouse.name.includes(warehouse.city))).toBe(true)
    expect(dataset.warehouses[0]?.stock.some((stock) => stock.productId === 1)).toBe(false)
    expect(
      dataset.products.every((product) => {
        const warehouseCount = dataset.warehouses.reduce(
          (total, warehouse) => total + Number(warehouse.stock.some((stock) => stock.productId === product._id)),
          0,
        )
        return warehouseCount >= 1 && warehouseCount <= 4
      }),
    ).toBe(true)

    const referrals = new Map(dataset.users.map((user) => [user._id, user.referredById]))
    expect(referrals.get(111)).toBe(114)
    expect(referrals.get(112)).toBe(111)
    expect(referrals.get(113)).toBe(112)
    expect(referrals.get(114)).toBe(113)

    const routeLengths = routeMetrics(dataset.routes, 1, 12)
    expect(routeLengths.hops).toBeGreaterThanOrEqual(3)
    expect(routeLengths.distanceHops).toBeGreaterThan(routeLengths.hops)
  })
})

function followsByDepth(follows: { followerId: number; followeeId: number }[], source: number): Map<number, number> {
  const outgoing = new Map<number, number[]>()
  for (const follow of follows) {
    const neighbors = outgoing.get(follow.followerId) ?? []
    neighbors.push(follow.followeeId)
    outgoing.set(follow.followerId, neighbors)
  }

  const depthByUser = new Map([[source, 0]])
  const queue = [source]
  for (let index = 0; index < queue.length; index += 1) {
    const userId = queue[index]!
    for (const followeeId of outgoing.get(userId) ?? []) {
      if (depthByUser.has(followeeId)) continue
      depthByUser.set(followeeId, depthByUser.get(userId)! + 1)
      queue.push(followeeId)
    }
  }
  return depthByUser
}

function routeMetrics(
  routes: { fromId: number; toId: number; distanceKm: number }[],
  source: number,
  target: number,
): { hops: number; distanceHops: number } {
  const adjacent = new Map<number, { to: number; distance: number }[]>()
  for (const route of routes) {
    const edges = adjacent.get(route.fromId) ?? []
    edges.push({ to: route.toId, distance: route.distanceKm })
    adjacent.set(route.fromId, edges)
  }
  const hopsByWarehouse = new Map([[source, 0]])
  const queue = [source]
  for (let index = 0; index < queue.length; index += 1) {
    const fromId = queue[index]!
    for (const edge of adjacent.get(fromId) ?? []) {
      if (hopsByWarehouse.has(edge.to)) continue
      hopsByWarehouse.set(edge.to, hopsByWarehouse.get(fromId)! + 1)
      queue.push(edge.to)
    }
  }

  const bestDistance = new Map([[source, 0]])
  const bestHops = new Map([[source, 0]])
  const visited = new Set<number>()
  while (true) {
    const next = [...bestDistance.keys()]
      .filter((id) => !visited.has(id))
      .sort((a, b) => bestDistance.get(a)! - bestDistance.get(b)!)[0]
    if (next === undefined || next === target) break
    visited.add(next)
    for (const edge of adjacent.get(next) ?? []) {
      const distance = bestDistance.get(next)! + edge.distance
      if (distance >= (bestDistance.get(edge.to) ?? Infinity)) continue
      bestDistance.set(edge.to, distance)
      bestHops.set(edge.to, bestHops.get(next)! + 1)
    }
  }
  return { hops: hopsByWarehouse.get(target)!, distanceHops: bestHops.get(target)! }
}

function addressIdentity(address: { street: string; city: string; zip: string }): string {
  return `${address.street}|${address.city}|${address.zip}`
}

function sameAddress(
  left: { street: string; city: string; zip: string },
  right: { street: string; city: string; zip: string },
): boolean {
  return addressIdentity(left) === addressIdentity(right)
}
