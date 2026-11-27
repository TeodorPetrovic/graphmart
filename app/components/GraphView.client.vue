<script setup lang="ts">
/**
 * Neo4j style graph drawing. If every node has numeric `props.x` and `props.y`
 * those positions are used (maps), otherwise a force directed layout runs.
 */
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { Graph, GraphNode } from '#shared/types/api'

const props = withDefaults(
  defineProps<{
    graph: Graph
    height?: string
    edgeLabels?: boolean
    kindLabels?: Record<string, string>
    edgeLabelMap?: Record<string, string>
  }>(),
  {
    height: '520px',
    edgeLabels: true,
  },
)
const emit = defineEmits<{ select: [node: GraphNode] }>()

const COLORS: Record<string, string> = {
  User: '#3b82f6',
  Product: '#22c55e',
  Category: '#a855f7',
  Brand: '#f59e0b',
  Device: '#ef4444',
  Card: '#ec4899',
  Address: '#14b8a6',
  Warehouse: '#f97316',
}
const KIND_LABELS: Record<string, string> = {
  User: 'People',
  Product: 'Products',
  Category: 'Categories',
  Brand: 'Brands',
  Device: 'Devices',
  Card: 'Payment cards',
  Address: 'Addresses',
  Warehouse: 'Warehouses',
}
const EDGE_LABELS: Record<string, string> = {
  FOLLOWS: 'follows',
  REFERRED: 'referred',
  PURCHASED: 'bought',
  VIEWED: 'viewed',
  RATED: 'rated',
  USED_DEVICE: 'used device',
  PAID_WITH: 'paid with',
  SHIPS_TO: 'ships to',
  ROUTE_TO: 'route to',
  STOCKS: 'stocks',
  IN_CATEGORY: 'in category',
  SUBCATEGORY_OF: 'subcategory of',
  MADE_BY: 'made by',
}
const displayEdge = (type: string) => props.edgeLabelMap?.[type] ?? EDGE_LABELS[type] ?? type

const container = ref<HTMLDivElement>()
let instance: Core | null = null
const colorMode = useColorMode()

const kinds = computed(() => [...new Set(props.graph.nodes.map((node) => node.kind))])
const displayKind = (kind: string) => props.kindLabels?.[kind] ?? KIND_LABELS[kind] ?? kind

function elements(graph: Graph): ElementDefinition[] {
  const ids = new Set(graph.nodes.map((node) => node.id))
  return [
    ...graph.nodes.map((node) => ({
      data: { id: node.id, label: node.label, color: COLORS[node.kind] ?? '#64748b' },
      // Only maps carry coordinates; other graphs are arranged by the force layout.
      ...(typeof node.props?.x === 'number' && typeof node.props?.y === 'number'
        ? { position: { x: node.props.x, y: node.props.y } }
        : {}),
      classes: node.highlight ? 'highlight' : '',
    })),
    // Cytoscape throws on dangling edges, so keep only edges whose ends are present.
    ...graph.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        data: { id: edge.id, source: edge.source, target: edge.target, label: displayEdge(edge.type) },
        classes: edge.highlight ? 'highlight' : '',
      })),
  ]
}

function draw() {
  instance?.destroy()
  if (!container.value) return
  const positioned =
    props.graph.nodes.length > 0 &&
    props.graph.nodes.every((n) => typeof n.props?.x === 'number' && typeof n.props?.y === 'number')
  const labelColor = colorMode.value === 'dark' ? '#e2e8f0' : '#334155'
  const edgeColor = colorMode.value === 'dark' ? '#cbd5e1' : '#64748b'
  instance = cytoscape({
    container: container.value,
    elements: elements(props.graph),
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          label: 'data(label)',
          color: labelColor,
          'font-size': 14,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          width: 22,
          height: 22,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1,
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          opacity: 0.65,
          label: props.edgeLabels ? 'data(label)' : '',
          'font-size': 12,
          color: labelColor,
          'text-rotation': 'autorotate',
        },
      },
      { selector: 'node.highlight', style: { width: 34, height: 34, 'border-width': 4, 'border-color': '#facc15' } },
      {
        selector: 'edge.highlight',
        style: { width: 4, 'line-color': '#facc15', 'target-arrow-color': '#facc15', opacity: 1 },
      },
    ],
    // Without a cap, fitting a graph of a few nodes would zoom until labels fill the screen.
    maxZoom: 1.6,
    layout: positioned
      ? { name: 'preset', fit: true, padding: 50 }
      : {
          name: 'cose',
          animate: false,
          randomize: true,
          padding: 30,
          nodeRepulsion: () => 9000,
          idealEdgeLength: () => 90,
        },
  })
  instance.on('tap', 'node', (event) => {
    const node = props.graph.nodes.find((n) => n.id === event.target.id())
    if (node) emit('select', node)
  })
}

// A `.client` component can mount before its template ref exists, so drawing follows the ref
// itself as well as the data and theme.
watch([container, () => props.graph, () => colorMode.value], draw, { flush: 'post' })
onBeforeUnmount(() => instance?.destroy())
</script>

<template>
  <figure class="rounded-lg border border-default bg-elevated/30">
    <div
      ref="container"
      class="w-full"
      :style="{ height }"
      role="img"
      :aria-label="`Graph with ${graph.nodes.length} nodes and ${graph.edges.length} relationships`"
    />
    <figcaption class="flex flex-wrap items-center gap-4 border-t border-default px-4 py-3 text-sm text-muted">
      <span v-for="kind in kinds" :key="kind" class="flex items-center gap-1.5">
        <span class="size-3 rounded-full" :style="{ background: COLORS[kind] ?? '#64748b' }" />{{ displayKind(kind) }}
      </span>
      <span class="ml-auto tabular-nums"
        >{{ graph.nodes.length }} people and places · {{ graph.edges.length }} connections</span
      >
    </figcaption>
  </figure>
</template>
