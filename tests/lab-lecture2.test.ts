import { describe, expect, test } from 'bun:test'
import { DEMO } from '../shared/utils/demo'
import { lectureTwo } from '../server/modules/lab/scenarios/lecture-2'
import { validateParams } from '../server/modules/lab/params'

describe('lecture two graph lab scenarios', () => {
  test('registers all nine lessons in presentation order with the intended engines', () => {
    expect(lectureTwo.map((scenario) => scenario.id)).toEqual([
      'friends-network',
      'people-you-may-know',
      'also-bought',
      'social-recommendations',
      'shortest-path',
      'referral-chain',
      'fraud-rings',
      'delivery-route',
      'polyglot-recommendation',
    ])
    expect(lectureTwo.map((scenario) => scenario.order)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect(lectureTwo.every((scenario) => scenario.lecture === 2)).toBe(true)
    expect(lectureTwo.every((scenario) => scenario.engines.some((engine) => engine.engine === 'mysql'))).toBe(true)
    expect(
      lectureTwo.find((scenario) => scenario.id === 'referral-chain')?.engines.map((engine) => engine.engine),
    ).toEqual(['mysql', 'mongo', 'neo4j'])
    expect(
      lectureTwo.find((scenario) => scenario.id === 'polyglot-recommendation')?.engines.map((engine) => engine.engine),
    ).toEqual(['mysql', 'neo4j'])
  })

  test('uses guaranteed demo defaults and bounded traversal scaling sets', () => {
    expect(validateParams(lectureTwo[0]!.params).userId).toBe(DEMO.userId)
    expect(validateParams(lectureTwo[4]!.params)).toMatchObject({
      fromId: DEMO.userId,
      toId: DEMO.distantUserId,
      maxDepth: 5,
    })
    expect(validateParams(lectureTwo[5]!.params).userId).toBe(DEMO.referralCycleUserIds[0])
    expect(lectureTwo.find((scenario) => scenario.id === 'friends-network')?.scaling).toEqual(
      [1, 2, 3, 4, 5].map((depth) => ({ userId: DEMO.userId, depth })),
    )
    expect(lectureTwo.find((scenario) => scenario.id === 'shortest-path')?.scaling).toEqual(
      [3, 4, 5, 6].map((maxDepth) => ({ fromId: DEMO.userId, toId: DEMO.distantUserId, maxDepth })),
    )
  })

  test('presents the graph operators and polyglot hydration steps in the query text', () => {
    const cypher = lectureTwo
      .flatMap((scenario) =>
        scenario.engines
          .filter((engine) => engine.engine === 'neo4j')
          .map((engine) => engine.query(validateParams(scenario.params))),
      )
      .join('\n')

    expect(cypher).toContain('FOLLOWS*1..')
    expect(cypher).toContain('SHORTEST 1')
    expect(cypher).toContain('EXISTS {')
    expect(cypher).toContain('reduce(')
    expect(cypher).toContain('db.products.find')
    expect(cypher).toContain('REFERRED*1..8')
    expect(cypher).toContain('USED_DEVICE|PAID_WITH|SHIPS_TO')
  })
})
