import type { CheckoutPreviewRequest, CheckoutPreviewResponse } from '../../../shared/types/api'
import { type Tracer } from '../../infrastructure/trace'
import { buildGraph, type GraphEdgeInput, type GraphNodeInput } from '../graph/dto'
import { chooseDestination, scoreTrust, trustSignalText } from './logic'
import {
  findCheckoutProducts,
  findCheckoutUser,
  findDelivery,
  findTrustLinks,
  findWarehouses,
  type CheckoutProduct,
  type TrustRow,
} from './repository'

export class CheckoutPreviewFailure extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export async function previewCheckout(input: CheckoutPreviewRequest, tracer: Tracer): Promise<CheckoutPreviewResponse> {
  const user = await findCheckoutUser(input.userId, tracer)
  if (!user) throw new CheckoutPreviewFailure(404, 'User not found')

  const quantities = mergeQuantities(input)
  const products = await findCheckoutProducts([...quantities.keys()], tracer)
  assertAllProductsFound(quantities, products)
  const items = makeItems(quantities, products)

  const trustRow = await findTrustLinks(input.userId, user.addresses, input, tracer)
  const trust = makeTrust(trustRow, input.userId, user.name)
  const delivery = await makeDelivery(user.city, items, tracer)

  return {
    items,
    totalCents: items.reduce((total, item) => total + item.product.priceCents * item.quantity, 0),
    trust,
    delivery,
    trace: tracer.entries,
  }
}

function mergeQuantities(input: CheckoutPreviewRequest): Map<number, number> {
  const quantities = new Map<number, number>()
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
  return quantities
}

function assertAllProductsFound(quantities: Map<number, number>, products: CheckoutProduct[]): void {
  if (products.length === quantities.size) return
  const found = new Set(products.map((product) => product._id))
  const unknown = [...quantities.keys()].find((id) => !found.has(id))
  throw new CheckoutPreviewFailure(404, `Product ${unknown} not found`)
}

function makeItems(quantities: Map<number, number>, products: CheckoutProduct[]) {
  return products.map((product) => {
    const quantity = quantities.get(product._id) ?? 0
    return {
      product: {
        id: product._id,
        name: product.name,
        brand: product.brand,
        categoryId: product.categoryId,
        priceCents: product.priceCents,
        stock: product.stock,
        rating: product.ratingSummary.avg,
        ratingCount: product.ratingSummary.count,
      },
      quantity,
      available: product.stock >= quantity,
    }
  })
}

function makeTrust(row: TrustRow | undefined, userId: number, userName: string) {
  const linked = row?.linked ?? []
  const linkedAccounts = linked.map(({ id, name, via }) => ({ id, name, via }))
  const score = scoreTrust({
    linkedAccounts: row?.linkedCount ?? 0,
    sharedDevices: Number((row?.sharedDeviceAccounts ?? 0) > 0),
    sharedCards: Number((row?.sharedCardAccounts ?? 0) > 0),
    sharedAddresses: Number((row?.sharedAddressAccounts ?? 0) > 0),
  })
  return {
    ...score,
    signals: makeSignals(row),
    linkedAccounts,
    graph: makeTrustGraph(userId, userName, linked),
  }
}

function makeSignals(row: TrustRow | undefined) {
  const signals: { label: string; detail: string }[] = []
  for (const [kind, count] of [
    ['card', row?.sharedCardAccounts ?? 0],
    ['device', row?.sharedDeviceAccounts ?? 0],
    ['address', row?.sharedAddressAccounts ?? 0],
  ] as const) {
    if (count > 0) {
      const label = `${kind[0]!.toUpperCase()}${kind.slice(1)} shared`
      signals.push({ label, detail: trustSignalText(kind, count) })
    }
  }
  return signals
}

function makeTrustGraph(userId: number, userName: string, linked: TrustRow['linked']): ReturnType<typeof buildGraph> {
  const nodes: GraphNodeInput[] = [{ kind: 'User', key: userId, label: userName, highlight: true }]
  const edges: GraphEdgeInput[] = []
  for (const account of linked) {
    nodes.push({ kind: 'User', key: account.id, label: account.name })
    for (const resource of account.resources) {
      nodes.push({ kind: resource.kind, key: resource.key, label: resourceLabel(resource.kind) })
      edges.push({
        type: relationshipType(resource.kind),
        sourceKind: 'User',
        sourceKey: userId,
        targetKind: resource.kind,
        targetKey: resource.key,
      })
      edges.push({
        type: relationshipType(resource.kind),
        sourceKind: 'User',
        sourceKey: account.id,
        targetKind: resource.kind,
        targetKey: resource.key,
      })
    }
  }
  return buildGraph(nodes, edges)
}

function resourceLabel(kind: string): string {
  if (kind === 'Device') return 'Shared device'
  if (kind === 'Card') return 'Shared card'
  return 'Shared address'
}

function relationshipType(kind: string): string {
  if (kind === 'Device') return 'USED_DEVICE'
  if (kind === 'Card') return 'PAID_WITH'
  return 'SHIPS_TO'
}

async function makeDelivery(city: string, items: ReturnType<typeof makeItems>, tracer: Tracer) {
  const warehouses = await findWarehouses(tracer)
  const destination = chooseDestination(city, warehouses)
  if (!destination) throw new Error('No delivery warehouse is available')
  const shipments = await Promise.all(
    items.map(async ({ product, quantity }) => {
      const row = await findDelivery(product.id, quantity, destination.id, tracer)
      return {
        productId: product.id,
        productName: product.name,
        from: row ? { warehouseId: row.warehouseId, city: row.city } : null,
        route: row
          ? { stops: row.stops, distanceKm: row.distanceKm, durationMin: row.durationMin, hops: row.hops }
          : null,
      }
    }),
  )
  const durations = shipments.flatMap((shipment) => (shipment.route ? [shipment.route.durationMin] : []))
  return {
    destination: { warehouseId: destination.id, city: destination.city },
    shipments,
    estimatedMinutes: durations.length ? Math.max(...durations) : null,
  }
}
