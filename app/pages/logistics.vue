<script setup lang="ts">
import type {
  FulfillmentResponse,
  LogisticsNetworkResponse,
  ProductSearchResponse,
  RouteMetric,
  RouteResponse,
} from '#shared/types/api'
import { DEMO, formatPrice } from '#shared/utils/demo'

const from = ref(String(DEMO.warehouseFromId))
const to = ref(String(DEMO.warehouseToId))
const productId = ref(String(DEMO.productId))
const metric = ref<RouteMetric>('duration')
const metrics = [
  { label: 'Fastest', value: 'duration' },
  { label: 'Shortest', value: 'distance' },
  { label: 'Fewest stops', value: 'hops' },
]
const [
  { data: network, status: networkStatus, error: networkError },
  { data: products, status: productStatus, error: productError },
] = await Promise.all([
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
  warehouses.value.map((item) => ({ label: `${item.city} · ${item.name}`, value: String(item.id) })),
)
const productOptions = computed(() =>
  (products.value?.items ?? []).map((item) => ({
    label: `${item.name} · ${formatPrice(item.priceCents)}`,
    value: String(item.id),
  })),
)
const mapGraph = computed(() => {
  const graph = network.value?.graph
  if (!graph || !warehouses.value.length) return { nodes: [], edges: [] }
  const byId = new Map(warehouses.value.map((item) => [item.id, item]))
  const latitudes = warehouses.value.map((item) => item.lat)
  const longitudes = warehouses.value.map((item) => item.lng)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)
  return {
    nodes: graph.nodes.map((node) => {
      const warehouse = byId.get(Number(node.id.split(':').at(-1)))
      return warehouse
        ? {
            ...node,
            props: {
              ...node.props,
              x: 60 + ((warehouse.lng - minLng) / (maxLng - minLng || 1)) * 680,
              y: 50 + ((maxLat - warehouse.lat) / (maxLat - minLat || 1)) * 300,
            },
          }
        : node
    }),
    edges: graph.edges,
  }
})
const routes = computed(() => {
  const best = route.value?.best
  const alternatives = route.value?.alternatives ?? []
  if (!best) return []
  const all = [best, ...alternatives]
  const fastest = all.reduce((a, b) => (a.durationMin <= b.durationMin ? a : b))
  const shortest = all.reduce((a, b) => (a.distanceKm <= b.distanceKm ? a : b))
  const fewest = all.reduce((a, b) => (a.hops <= b.hops ? a : b))
  return [
    { title: 'Fastest', route: fastest },
    { title: 'Shortest', route: shortest },
    { title: 'Fewest stops', route: fewest },
  ]
})
const bestRoute = computed(() => route.value?.best)
</script>

<template>
  <main class="space-y-6 p-6 lg:p-8">
    <PageHeader
      eyebrow="Store team"
      title="Plan a delivery"
      description="Choose an item and destination to find a warehouse that can ship it, then compare the available routes."
    />
    <InsightFeatureInsight feature="delivery" :trace="route?.trace" />
    <UCard>
      <template #header><h2 class="text-xl font-semibold">Delivery details</h2></template>
      <LoadState :status="productStatus" :error="productError">
        <UAlert
          v-if="!productOptions.length"
          color="neutral"
          title="No products to choose from"
          description="Products will appear here when they are available in the catalog."
        />
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Product">
            <USelectMenu
              v-model="productId"
              :items="productOptions"
              value-key="value"
              :disabled="!productOptions.length"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Destination warehouse">
            <USelectMenu v-model="to" :items="warehouseOptions" value-key="value" class="w-full" />
          </UFormField>
        </div>
      </LoadState>
    </UCard>
    <section class="space-y-5">
      <UCard>
        <template #header
          ><div>
            <h2 class="text-xl font-semibold">Where it ships from</h2>
            <p class="text-sm text-muted">The warehouse holding this item with the best route to the destination.</p>
          </div></template
        >
        <LoadState :status="fulfillmentStatus" :error="fulfillmentError">
          <div v-if="fulfillment?.options.length" class="space-y-4">
            <div v-for="(option, index) in fulfillment.options.slice(0, 1)" :key="option.warehouseId">
              <UBadge v-if="index === 0" color="success">Best warehouse</UBadge>
              <h3 class="mt-2 text-lg font-semibold">{{ option.name }} · {{ option.route.stops[0]?.city }}</h3>
              <p class="text-sm text-muted">{{ option.quantity }} available to ship</p>
              <UStepper
                :items="
                  option.route.stops.map((stop, stopIndex) => ({
                    title: stop.city,
                    description: stop.name,
                    icon: stopIndex === 0 ? 'i-lucide-warehouse' : 'i-lucide-map-pin',
                  }))
                "
                class="mt-5"
              />
              <div class="mt-5 flex flex-wrap gap-3">
                <UBadge color="neutral" variant="subtle">{{ option.route.distanceKm }} km</UBadge>
                <UBadge color="neutral" variant="subtle">{{ option.route.durationMin }} min</UBadge>
                <UBadge color="neutral" variant="subtle">{{ option.route.hops }} legs</UBadge>
              </div>
            </div>
          </div>
          <UEmpty
            v-else
            icon="i-lucide-package-x"
            title="No warehouse can ship this item"
            description="Try a different product or destination."
          />
        </LoadState>
      </UCard>
      <UCard>
        <template #header
          ><div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold">Compare routes</h2>
              <p class="text-sm text-muted">Between any warehouse and the destination.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <USelectMenu v-model="from" :items="warehouseOptions" value-key="value" class="w-64" aria-label="Start" />
              <USelect v-model="metric" :items="metrics" aria-label="Optimise for" />
            </div></div
        ></template>
        <LoadState :status="routeStatus" :error="routeError"
          ><div v-if="bestRoute" class="space-y-4">
            <p class="text-sm">
              <strong>Selected route:</strong> {{ bestRoute.stops.map((stop) => stop.city).join(' → ') }}
            </p>
            <div class="grid gap-3 sm:grid-cols-3">
              <UCard v-for="choice in routes" :key="choice.title" variant="subtle"
                ><p class="text-sm font-semibold">{{ choice.title }}</p>
                <p class="mt-2 text-xl font-bold">
                  {{
                    choice.title === 'Fastest'
                      ? `${choice.route.durationMin} min`
                      : choice.title === 'Shortest'
                        ? `${choice.route.distanceKm} km`
                        : `${choice.route.hops} legs`
                  }}
                </p>
                <p class="mt-1 text-sm text-muted">
                  {{ choice.route.distanceKm }} km · {{ choice.route.durationMin }} min
                </p></UCard
              >
            </div>
            <GraphView :graph="route?.graph ?? { nodes: [], edges: [] }" height="330px" :edge-labels="false" />
          </div>
          <UEmpty
            v-else
            icon="i-lucide-route"
            title="No route found"
            description="Choose different warehouses to compare routes."
        /></LoadState>
      </UCard>
    </section>
    <UCard>
      <template #header
        ><div>
          <h2 class="text-xl font-semibold">Warehouse map</h2>
          <p class="text-sm text-muted">A view of the delivery network supporting the route above.</p>
        </div></template
      >
      <LoadState :status="networkStatus" :error="networkError"
        ><GraphView :graph="mapGraph" height="340px" :edge-labels="false"
      /></LoadState>
    </UCard>
  </main>
</template>
