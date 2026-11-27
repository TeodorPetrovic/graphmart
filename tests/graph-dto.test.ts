import { describe, expect, test } from 'bun:test'
import { buildGraph } from '../server/modules/graph/dto'

describe('graph DTO conversion', () => {
  test('uses stable kind ids, deduplicates nodes and highlights nodes and edges', () => {
    const graph = buildGraph(
      [
        { kind: 'User', key: 4, label: 'Mira', props: { city: 'Novi Sad' } },
        { kind: 'User', key: 4, label: 'duplicate' },
        { kind: 'Product', key: 8, label: 'Lamp' },
      ],
      [{ type: 'PURCHASED', sourceKind: 'User', sourceKey: 4, targetKind: 'Product', targetKey: 8 }],
      ['User:4'],
    )
    expect(graph.nodes.map((n) => n.id)).toEqual(['User:4', 'Product:8'])
    expect(graph.nodes[0]?.highlight).toBe(true)
    expect(graph.edges[0]?.id).toBe('PURCHASED:User:4:Product:8:')
  })
})
