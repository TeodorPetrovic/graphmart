import type { CheckoutPreviewRequest } from '../../../shared/types/api'
import type { Address, ProductDoc, UserDoc } from '../../../shared/types/domain'
import { addressKey } from '../../../shared/utils/address'
import { collections } from '../../infrastructure/mongo/client'
import { int, readCypher } from '../../infrastructure/neo4j/client'
import { shell, type Tracer } from '../../infrastructure/trace'

export type CheckoutUser = Pick<UserDoc, 'name' | 'city' | 'addresses'>
export type CheckoutProduct = Pick<
  ProductDoc,
  '_id' | 'name' | 'brand' | 'categoryId' | 'priceCents' | 'stock' | 'ratingSummary'
>

export interface TrustRow {
  linkedCount: number
  sharedDeviceAccounts: number
  sharedCardAccounts: number
  sharedAddressAccounts: number
  linked: {
    id: number
    name: string
    via: ('device' | 'card' | 'address')[]
    resources: { kind: string; key: string }[]
  }[]
}

export interface WarehouseLocation {
  id: number
  name: string
  city: string
  lat: number
  lng: number
}

export interface DeliveryRow {
  warehouseId: number
  name: string
  city: string
  quantity: number
  stops: { id: number; name: string; city: string }[]
  distanceKm: number
  durationMin: number
  hops: number
}

const TRUST_QUERY = `
// Exact checkout identifiers and the user's saved addresses reveal direct account links.
MATCH (linked:User)
WHERE linked.id <> $userId
  AND (
    ($deviceId <> '' AND EXISTS { (linked)-[:USED_DEVICE]->(:Device {id:$deviceId}) })
    OR ($cardFingerprint IS NOT NULL AND EXISTS { (linked)-[:PAID_WITH]->(:Card {fingerprint:$cardFingerprint}) })
    OR EXISTS { (linked)-[:SHIPS_TO]->(address:Address) WHERE address.key IN $addressKeys }
  )
WITH linked,
     [(linked)-[:USED_DEVICE]->(device:Device) WHERE device.id = $deviceId | {kind:'Device',key:device.id}] AS devices,
     [(linked)-[:PAID_WITH]->(card:Card) WHERE $cardFingerprint IS NOT NULL AND card.fingerprint = $cardFingerprint | {kind:'Card',key:card.fingerprint}] AS cards,
     [(linked)-[:SHIPS_TO]->(address:Address) WHERE address.key IN $addressKeys | {kind:'Address',key:address.key}] AS addresses
WITH linked, devices, cards, addresses,
     [kind IN CASE WHEN size(devices) > 0 THEN ['device'] ELSE [] END +
                 CASE WHEN size(cards) > 0 THEN ['card'] ELSE [] END +
                 CASE WHEN size(addresses) > 0 THEN ['address'] ELSE [] END | kind] AS via
WITH collect({id:linked.id,name:linked.name,via:via,resources:devices + cards + addresses}) AS accounts,
     count(*) AS linkedCount,
     count(CASE WHEN 'device' IN via THEN 1 END) AS sharedDeviceAccounts,
     count(CASE WHEN 'card' IN via THEN 1 END) AS sharedCardAccounts,
     count(CASE WHEN 'address' IN via THEN 1 END) AS sharedAddressAccounts
RETURN linkedCount, sharedDeviceAccounts, sharedCardAccounts, sharedAddressAccounts,
       accounts[..20] AS linked
`

const WAREHOUSE_QUERY = `
// Warehouse coordinates and stock are projected to Neo4j with directed transport links.
MATCH (warehouse:Warehouse)
RETURN warehouse.id AS id, warehouse.name AS name, warehouse.city AS city,
       warehouse.lat AS lat, warehouse.lng AS lng
ORDER BY warehouse.id
`

const DELIVERY_QUERY = `
// Each stocked source contributes its quickest bounded route to the chosen destination.
MATCH (destination:Warehouse {id:$destination})
MATCH (source:Warehouse)-[stock:STOCKS]->(:Product {id:$productId})
WHERE stock.quantity >= $quantity
CALL (source, destination) {
  WITH source, destination
  WHERE source = destination
  RETURN [source] AS stops, 0.0 AS distanceKm, 0.0 AS durationMin, 0 AS hops
  UNION
  WITH source, destination
  WHERE source <> destination
  MATCH path=(source)-[:ROUTE_TO*1..6]->(destination)
  WHERE all(node IN nodes(path) WHERE single(candidate IN nodes(path) WHERE candidate = node))
  WITH path,
       reduce(total=0.0, route IN relationships(path) | total + route.distanceKm) AS distanceKm,
       reduce(total=0.0, route IN relationships(path) | total + route.durationMin) AS durationMin
  ORDER BY durationMin, distanceKm, length(path), [node IN nodes(path) | node.id]
  LIMIT 1
  RETURN nodes(path) AS stops, distanceKm, durationMin, length(path) AS hops
}
RETURN source.id AS warehouseId, source.name AS name, source.city AS city,
       stock.quantity AS quantity,
       [node IN stops | {id:node.id,name:node.name,city:node.city}] AS stops,
       distanceKm, durationMin, hops
ORDER BY durationMin, distanceKm, hops, warehouseId
LIMIT 1
`

export async function findCheckoutUser(userId: number, tracer: Tracer): Promise<CheckoutUser | null> {
  const filter = { _id: userId }
  return tracer.run('mongo', 'Load checkout user', shell('users', 'findOne', filter), () =>
    collections().users.findOne(filter, { projection: { name: 1, city: 1, addresses: 1 } }),
  )
}

export async function findCheckoutProducts(ids: number[], tracer: Tracer): Promise<CheckoutProduct[]> {
  const filter = { _id: { $in: ids } }
  return tracer.run('mongo', 'Load checkout products', shell('products', 'find', filter), () =>
    collections()
      .products.find(filter, {
        projection: { name: 1, brand: 1, categoryId: 1, priceCents: 1, stock: 1, ratingSummary: 1 },
      })
      .toArray(),
  )
}

export async function findTrustLinks(
  userId: number,
  userAddresses: Address[],
  input: CheckoutPreviewRequest,
  tracer: Tracer,
): Promise<TrustRow | undefined> {
  const rows = await readCypher<TrustRow>(
    TRUST_QUERY,
    {
      userId: int(userId),
      deviceId: input.deviceId,
      cardFingerprint: input.cardFingerprint ?? null,
      addressKeys: userAddresses.map(addressKey),
    },
    { tracer, operation: 'Checkout trust links' },
  )
  return rows[0]
}

export function findWarehouses(tracer: Tracer): Promise<WarehouseLocation[]> {
  return readCypher<WarehouseLocation>(WAREHOUSE_QUERY, {}, { tracer, operation: 'Choose delivery destination' })
}

export async function findDelivery(
  productId: number,
  quantity: number,
  destinationId: number,
  tracer: Tracer,
): Promise<DeliveryRow | undefined> {
  const rows = await readCypher<DeliveryRow>(
    DELIVERY_QUERY,
    { destination: int(destinationId), productId: int(productId), quantity: int(quantity) },
    { tracer, operation: `Route product ${productId} to destination` },
  )
  return rows[0]
}
