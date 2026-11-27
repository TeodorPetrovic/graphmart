import { fraudRisk } from '../fraud/logic'

export type TrustLevel = 'clear' | 'review' | 'high'

export interface TrustScoreInput {
  linkedAccounts: number
  sharedDevices: number
  sharedCards: number
  sharedAddresses: number
}

export function scoreTrust(input: TrustScoreInput): { score: number; level: TrustLevel } {
  const score = fraudRisk(input.linkedAccounts + 1, input.sharedDevices, input.sharedCards, input.sharedAddresses)
  return { score, level: score >= 60 ? 'high' : score >= 30 ? 'review' : 'clear' }
}

export interface WarehouseLocation {
  id: number
  city: string
  lat: number
  lng: number
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  belgrade: [44.7866, 20.4489],
  'novi sad': [45.2671, 19.8335],
  nis: [43.3209, 21.8958],
  zagreb: [45.815, 15.9819],
  sarajevo: [43.8563, 18.4131],
  ljubljana: [46.0569, 14.5058],
  skopje: [41.9981, 21.4254],
  podgorica: [42.4304, 19.2594],
  tirana: [41.3275, 19.8187],
  sofia: [42.6977, 23.3219],
  bucharest: [44.4268, 26.1025],
  budapest: [47.4979, 19.0402],
  vienna: [48.2082, 16.3738],
  athens: [37.9838, 23.7275],
  istanbul: [41.0082, 28.9784],
}

export function chooseDestination(city: string, warehouses: WarehouseLocation[]): WarehouseLocation | undefined {
  const sameCity = warehouses.find((warehouse) => warehouse.city.toLowerCase() === city.toLowerCase())
  if (sameCity) return sameCity

  const coordinates = CITY_COORDINATES[city.toLowerCase()]
  if (!coordinates) return warehouses.find((warehouse) => warehouse.id === 1)

  return warehouses.reduce<WarehouseLocation | undefined>((closest, warehouse) => {
    if (!closest) return warehouse
    const distance = greatCircleKm(coordinates[0], coordinates[1], warehouse.lat, warehouse.lng)
    const closestDistance = greatCircleKm(coordinates[0], coordinates[1], closest.lat, closest.lng)
    return distance < closestDistance ? warehouse : closest
  }, undefined)
}

function greatCircleKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLat = radians(lat2 - lat1)
  const deltaLng = radians(lng2 - lng1)
  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function trustSignalText(kind: 'card' | 'device' | 'address', accountCount: number): string {
  const subject = kind === 'card' ? 'This card' : kind === 'device' ? 'This device' : 'This address'
  const noun = accountCount === 1 ? 'account' : 'other accounts'
  return `${subject} is also used by ${accountCount} ${noun}`
}

export function recommendationReason(
  kind: 'social' | 'collaborative' | 'category',
  names: string[],
  total: number,
): string {
  const examples = names.slice(0, 3)
  const named = examples.length > 0 ? examples.join(', ') : 'shoppers'
  const others = Math.max(0, total - examples.length)
  const people = others > 0 ? `${named} and ${others} ${others === 1 ? 'other' : 'others'}` : named
  if (kind === 'social') return `Bought by ${people} in your network`
  if (kind === 'collaborative') return `Shoppers with purchases like yours, such as ${named}, bought this`
  return examples.length ? `Because you look at ${examples[0]}` : 'Because you look at products in related categories'
}
