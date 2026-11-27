import { describe, expect, test } from 'bun:test'
import { chooseDestination, recommendationReason, scoreTrust, trustSignalText } from '../server/modules/checkout/logic'

describe('checkout and recommendation explanations', () => {
  test('scores linked accounts and maps score to trust level', () => {
    expect(scoreTrust({ linkedAccounts: 5, sharedDevices: 1, sharedCards: 1, sharedAddresses: 0 })).toEqual({
      score: 100,
      level: 'high',
    })
    expect(scoreTrust({ linkedAccounts: 0, sharedDevices: 0, sharedCards: 0, sharedAddresses: 0 })).toEqual({
      score: 0,
      level: 'clear',
    })
  })

  test('chooses a same-city warehouse, nearest known city, and warehouse one fallback', () => {
    const warehouses = [
      { id: 1, city: 'Belgrade', lat: 44.7866, lng: 20.4489 },
      { id: 2, city: 'Novi Sad', lat: 45.2671, lng: 19.8335 },
    ]
    expect(chooseDestination('Novi Sad', warehouses)?.id).toBe(2)
    expect(chooseDestination('Nis', warehouses)?.id).toBe(1)
    expect(chooseDestination('Unknown city', warehouses)?.id).toBe(1)
  })

  test('uses clear language and reports totals beyond named examples', () => {
    expect(trustSignalText('card', 5)).toBe('This card is also used by 5 other accounts')
    expect(recommendationReason('social', ['Emma Petrovic', 'Leo Kovac', 'Iva Markovic'], 7)).toBe(
      'Bought by Emma Petrovic, Leo Kovac, Iva Markovic and 4 others in your network',
    )
    expect(recommendationReason('category', ['Laptops'], 1)).toBe('Because you look at Laptops')
  })
})
