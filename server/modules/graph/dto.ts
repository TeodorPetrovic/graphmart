import type { Graph, GraphEdge, GraphNode } from '../../../shared/types/api'

export interface GraphNodeInput {
  kind: string
  key: string | number
  label?: string
  props?: Record<string, unknown>
  highlight?: boolean
}

export interface GraphEdgeInput {
  type: string
  sourceKind: string
  sourceKey: string | number
  targetKind: string
  targetKey: string | number
  key?: string | number
  props?: Record<string, unknown>
  highlight?: boolean
}

const NODE_CAP = 180
const EDGE_CAP = 360
const PROP_CAP = 8

function cappedProps(props: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!props) return undefined
  return Object.fromEntries(Object.entries(props).slice(0, PROP_CAP))
}

/** Converts bounded Cypher projections into stable UI ids and caps graph payloads. */
export function buildGraph(nodes: GraphNodeInput[], edges: GraphEdgeInput[], highlights: string[] = []): Graph {
  const highlighted = new Set(highlights)
  const nodeMap = new Map<string, GraphNode>()
  for (const node of nodes.slice(0, NODE_CAP)) {
    const id = `${node.kind}:${node.key}`
    nodeMap.set(id, {
      id,
      label: node.label ?? String(node.props?.name ?? node.key),
      kind: node.kind,
      ...(node.highlight || highlighted.has(id) ? { highlight: true } : {}),
      ...(cappedProps(node.props) ? { props: cappedProps(node.props) } : {}),
    })
  }
  const edgeMap = new Map<string, GraphEdge>()
  for (const edge of edges.slice(0, EDGE_CAP)) {
    const source = `${edge.sourceKind}:${edge.sourceKey}`
    const target = `${edge.targetKind}:${edge.targetKey}`
    if (!nodeMap.has(source) || !nodeMap.has(target)) continue
    const id = `${edge.type}:${source}:${target}:${edge.key ?? ''}`
    edgeMap.set(id, {
      id,
      source,
      target,
      type: edge.type,
      ...(edge.highlight || highlighted.has(id) ? { highlight: true } : {}),
      ...(cappedProps(edge.props) ? { props: cappedProps(edge.props) } : {}),
    })
  }
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] }
}
