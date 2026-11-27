import { describe, expect, test } from 'bun:test'
import { fraudRisk, groupFraudLinks } from '../server/modules/fraud/logic'

describe('fraud component scoring', () => {
  test('merges shared identity links into qualifying components', () => {
    const groups = groupFraudLinks(
      [
        { left: 1, right: 2, device: 'd1', card: null, address: null },
        { left: 2, right: 3, device: null, card: 'c1', address: null },
        { left: 8, right: 9, device: null, card: null, address: 'a1' },
      ],
      3,
    )
    expect(groups.map((g) => g.userIds)).toEqual([[1, 2, 3]])
    expect(fraudRisk(3, 1, 1, 0)).toBe(75)
  })

  test('keeps all resource counts and sorts components deterministically', () => {
    const links = [
      { left: 8, right: 9, device: null, card: null, address: 'address-only' },
      { left: 2, right: 3, device: 'device-b', card: null, address: null },
      { left: 1, right: 2, device: 'device-a', card: 'card-a', address: 'address-a' },
      { left: 1, right: 2, device: 'device-b', card: 'card-b', address: null },
    ]
    const groups = groupFraudLinks(links, 2)
    expect(groups.map((group) => group.userIds)).toEqual([[1, 2, 3]])
    expect([...groups[0]!.devices].sort()).toEqual(['device-a', 'device-b'])
    expect([...groups[0]!.cards].sort()).toEqual(['card-a', 'card-b'])
    expect([...groups[0]!.addresses]).toEqual(['address-a'])
  })

  test('produces the same components when database rows arrive in a different order', () => {
    const links = [
      { left: 7, right: 8, device: 'd2', card: null, address: null },
      { left: 2, right: 7, device: null, card: 'c1', address: null },
    ]
    expect(groupFraudLinks(links, 2)).toEqual(groupFraudLinks([...links].reverse(), 2))
  })
})
