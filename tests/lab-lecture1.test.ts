import { describe, expect, test } from 'bun:test'
import { DEMO } from '../shared/utils/demo'
import { describeScenario, findScenario } from '../server/modules/lab/registry'

describe('lecture one lab scenarios', () => {
  test('registers the eight document modelling lessons in presentation order', () => {
    const scenarios = [
      'product-page',
      'attribute-filter',
      'order-history',
      'faceted-search',
      'monthly-revenue',
      'top-spenders',
      'index-impact',
      'category-tree',
    ].map(findScenario)

    expect(scenarios.map((scenario) => scenario.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(scenarios.every((scenario) => scenario.lecture === 1)).toBe(true)
    expect(scenarios.every((scenario) => scenario.engines.some((engine) => engine.engine === 'mysql'))).toBe(true)
    expect(scenarios.every((scenario) => scenario.engines.some((engine) => engine.engine === 'mongo'))).toBe(true)
    expect(findScenario('category-tree').engines.map((engine) => engine.engine)).toEqual(['mysql', 'mongo', 'neo4j'])
  })

  test('binds scenario values and includes both index paths in scaling runs', () => {
    const product = describeScenario(findScenario('product-page'))
    expect(product.engines[0]?.query).toContain('?')
    expect(product.engines[1]?.query).toContain(String(DEMO.productId))

    const impact = findScenario('index-impact')
    expect(impact.scaling).toEqual([
      { useIndex: 0, userId: DEMO.userId },
      { useIndex: 1, userId: DEMO.userId },
    ])
    expect(impact.engines[0]?.query({ useIndex: 0, userId: DEMO.userId })).toContain('IGNORE INDEX')
    expect(impact.engines[0]?.query({ useIndex: 1, userId: DEMO.userId })).not.toContain('IGNORE INDEX')
    expect(impact.engines[1]?.query({ useIndex: 0, userId: DEMO.userId })).toContain('$natural')
    expect(impact.engines[1]?.query({ useIndex: 1, userId: DEMO.userId })).not.toContain('$natural')
  })
})
