/**
 * Fixed ids that the seed generator guarantees, so demos and default
 * benchmark parameters always return interesting data at every scale.
 */
export const DEMO = {
  /** Well connected user with orders, follows, views, reviews and referrals. */
  userId: 1,
  /** Reachable from `userId` through FOLLOWS in exactly 4 hops (shortest). */
  distantUserId: 50,
  /** Members of a planted fraud ring that shares devices, cards and an address. */
  fraudRingUserIds: [101, 102, 103, 104, 105, 106],
  /** Planted referral cycle: 111 refers 112 refers 113 refers 114 refers 111. */
  referralCycleUserIds: [111, 112, 113, 114],
  /** Popular product that many users bought. */
  productId: 1,
  /** Root category ("Electronics") with a subtree at least 4 levels deep. */
  rootCategoryId: 1,
  /**
   * Leaf category "Laptops". Every product in it has the attributes `ram_gb`
   * (8|16|32|64), `storage_gb` (256|512|1024|2048), `color` ("black"|"silver"|"blue")
   * and `wifi6` (boolean).
   */
  laptopCategoryId: 3,
  /** Warehouses at opposite ends of the route network (several hops apart). */
  warehouseFromId: 1,
  warehouseToId: 12,
  warehouseCount: 12,
} as const

export const SCALES = {
  small: { users: 2_000, products: 1_000, orders: 8_000, reviews: 5_000, views: 30_000, avgFollows: 8 },
  medium: { users: 20_000, products: 5_000, orders: 100_000, reviews: 40_000, views: 300_000, avgFollows: 12 },
  large: { users: 100_000, products: 20_000, orders: 500_000, reviews: 200_000, views: 1_500_000, avgFollows: 15 },
} as const
export type ScaleName = keyof typeof SCALES

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
