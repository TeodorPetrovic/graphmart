<script setup lang="ts">
import type {
  FulfillmentResponse,
  LogisticsNetworkResponse,
  ProductSearchResponse,
  RouteMetric,
  RouteResponse,
} from '#shared/types/api'
import { DEMO, formatPrice } from '#shared/utils/demo'

const METRICS: { label: string; value: RouteMetric }[] = [
  { label: 'Fastest', value: 'duration' },
  { label: 'Shortest', value: 'distance' },
  { label: 'Fewest stops', value: 'hops' },
]
const from = ref(String(DEMO.warehouseFromId))
const to = ref(String(DEMO.warehouseToId))
const productId = ref(String(DEMO.productId))
const metric = ref<RouteMetric>('duration')
const [{ data: network, status: networkStatus, error: networkError }, { data: products }] = await Promise.all([
  useFetch<LogisticsNetworkResponse>('/api/logistics/network'),
  useFetch<ProductSearchResponse>('/api/catalog/products', { query: { pageSize: 48 } }),
])
const {
  data: route,
  status: routeStatus,
  error: routeError,
} = useFetch<RouteResponse>('/api/logistics/route', { query: { from, to, metric } })
const {
  data: fulfillment,
  status: fulfillmentStatus,
  error: fulfillmentError,
} = useFetch<FulfillmentResponse>('/api/logistics/fulfillment', { query: { productId, warehouseId: to } })

const warehouses = computed(() => network.value?.warehouses ?? [])
const warehouseOptions = computed(() =>
  warehouses.value.map((item) => ({ label: `${item.city}, ${item.name}`, value: String(item.id) })),
)
const productOptions = computed(() =>
  (products.value?.items ?? []).map((item) => ({
    label: `${item.name}, ${formatPrice(item.priceCents)}`,
    value: String(item.id),
  })),
)
const best = computed(() => fulfillment.value?.options[0])
const cities = (stops: { city: string }[]) => stops.map((stop) => stop.city).join(' → ')

/** The best route for each of the three goals, picked from the routes the server returned. */
const choices = computed(() => {
  const all = route.value?.best ? [route.value.best, ...route.value.alternatives] : []
  if (!all.length) return []
  const least = (value: (item: (typeof all)[number]) => number) => all.reduce((a, b) => (value(a) <= value(b) ? a : b))
  return [
    { goal: 'Fastest', ...least((item) => item.durationMin) },
    { goal: 'Shortest', ...least((item) => item.distanceKm) },
    { goal: 'Fewest stops', ...least((item) => item.hops) },
  ]
})

/** Places each warehouse by its longitude and latitude. */
const mapGraph = computed(() => {
  const graph = network.value?.graph
  if (!graph || !warehouses.value.length) return { nodes: [], edges: [] }
  const byId = new Map(warehouses.value.map((item) => [item.id, item]))
  const latitudes = warehouses.value.map((item) => item.lat)
  const longitudes = warehouses.value.map((item) => item.lng)
  const minLng = Math.min(...longitudes)
  const maxLat = Math.max(...latitudes)
  const width = Math.max(...longitudes) - minLng || 1
  const height = maxLat - Math.min(...latitudes) || 1
  return {
    nodes: graph.nodes.map((node) => {
      const warehouse = byId.get(Number(node.id.split(':').at(-1)))
      if (!warehouse) return node
      const x = 60 + ((warehouse.lng - minLng) / width) * 680
      const y = 50 + ((maxLat - warehouse.lat) / height) * 300
      return { ...node, props: { ...node.props, x, y } }
    }),
    edges: graph.edges,
  }
})
</script>

<template>
  <div class="space-y-8">
    <PageSection title="Ship from the best warehouse">
      <template #aside><InsightFeatureInsight feature="delivery" :trace="route?.trace" /></template>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Product">
          <USelectMenu v-model="productId" :items="productOptions" value-key="value" class="w-full" />
        </UFormField>
        <UFormField label="Destination">
          <USelectMenu v-model="to" :items="warehouseOptions" value-key="value" class="w-full" />
        </UFormField>
      </div>
      <LoadState :status="fulfillmentStatus" :error="fulfillmentError">
        <div v-if="best" class="space-y-1 text-sm">
          <p>
            <span class="font-semibold">{{ best.name }}</span> has {{ best.quantity }} in stock.
          </p>
          <p>{{ cities(best.route.stops) }}</p>
          <p class="text-muted tabular-nums">
            {{ best.route.distanceKm }} km, {{ best.route.durationMin }} minutes, {{ best.route.hops }} legs
          </p>
        </div>
        <p v-else class="text-sm text-muted">No warehouse can ship this product there.</p>
      </LoadState>
    </PageSection>

    <PageSection title="Compare routes">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Start">
          <USelectMenu v-model="from" :items="warehouseOptions" value-key="value" class="w-64" />
        </UFormField>
        <UFormField label="Draw on the map">
          <USelect v-model="metric" :items="METRICS" class="w-44" />
        </UFormField>
      </div>
      <LoadState :status="routeStatus" :error="routeError">
        <DataTable
          :rows="choices"
          :columns="[
            { key: 'goal', label: 'Goal' },
            { key: 'stops', label: 'Route' },
            { key: 'distanceKm', label: 'km', align: 'right' },
            { key: 'durationMin', label: 'Minutes', align: 'right' },
            { key: 'hops', label: 'Legs', align: 'right' },
          ]"
          empty="No route between these warehouses."
        >
          <template #stops="{ row }">{{ cities(row.stops) }}</template>
        </DataTable>
        <GraphView
          v-if="choices.length"
          class="mt-4"
          :graph="route?.graph ?? { nodes: [], edges: [] }"
          height="320px"
          :edge-labels="false"
        />
      </LoadState>
    </PageSection>

    <PageSection title="All warehouses and routes">
      <LoadState :status="networkStatus" :error="networkError">
        <GraphView :graph="mapGraph" height="360px" :edge-labels="false" />
      </LoadState>
    </PageSection>
  </div>
</template>
