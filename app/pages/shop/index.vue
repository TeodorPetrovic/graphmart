<script setup lang="ts">
import type { CategoryTreeResponse, ProductSearchResponse, ProductSummary } from '#shared/types/api'
import { useCart } from '~/composables/useCart'
const route = useRoute()
const router = useRouter()
const {
  data: categoryData,
  status: categoryStatus,
  error: categoryError,
} = useFetch<CategoryTreeResponse>('/api/catalog/categories')
const categoryLoadError = useLoadError(categoryError)
const q = ref(String(route.query.q ?? ''))
const categoryId = ref(String(route.query.categoryId ?? ''))
const brand = ref(String(route.query.brand ?? ''))
const minPrice = ref(priceQueryToInput(route.query.minPrice))
const maxPrice = ref(priceQueryToInput(route.query.maxPrice))
const sort = ref(String(route.query.sort ?? 'relevance'))
watch(
  () => route.query,
  (query) => {
    q.value = String(query.q ?? '')
    categoryId.value = String(query.categoryId ?? '')
    brand.value = String(query.brand ?? '')
    minPrice.value = priceQueryToInput(query.minPrice)
    maxPrice.value = priceQueryToInput(query.maxPrice)
    sort.value = String(query.sort ?? 'relevance')
  },
)
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))
const attrs = computed(() =>
  (Array.isArray(route.query.attr) ? route.query.attr : route.query.attr ? [route.query.attr] : []).map(String),
)
const query = computed(() => ({
  q: route.query.q,
  categoryId: route.query.categoryId,
  brand: route.query.brand,
  minPrice: route.query.minPrice,
  maxPrice: route.query.maxPrice,
  sort: route.query.sort,
  page: route.query.page,
  attr: attrs.value,
}))
const { data, status, error } = useFetch<ProductSearchResponse>('/api/catalog/products', { query, watch: [query] })
const loadError = useLoadError(error)
const cart = useCart()
function priceQueryToInput(value: unknown): string {
  const cents = Number(value)
  return value === undefined || value === null || !Number.isFinite(cents) ? '' : String(cents / 100)
}
function update(patch: Record<string, string | number | string[] | null | undefined>) {
  const next: Record<string, string | number | string[] | null | undefined> = {
    ...route.query,
    ...patch,
    page: patch.page ?? 1,
  }
  for (const [key, value] of Object.entries(next))
    if (value === '' || value === null || value === undefined) delete next[key]
  router.replace({ query: next })
}
function submitFilters() {
  update({
    q: q.value,
    categoryId: categoryId.value,
    brand: brand.value,
    minPrice: minPrice.value ? String(Math.round(Number(minPrice.value) * 100)) : '',
    maxPrice: maxPrice.value ? String(Math.round(Number(maxPrice.value) * 100)) : '',
    sort: sort.value,
  })
}
function toggleAttr(key: string, value: string) {
  const item = `${key}:${value}`
  update({ attr: attrs.value.includes(item) ? attrs.value.filter((a) => a !== item) : [...attrs.value, item] })
}
function changeSort(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  sort.value = event.target.value
  update({ sort: sort.value })
}
function flatten(nodes: CategoryTreeResponse['tree'], depth = 0): { id: number; name: string; depth: number }[] {
  return nodes.flatMap((node) => [{ id: node.id, name: node.name, depth }, ...flatten(node.children, depth + 1)])
}
const categories = computed(() => (categoryData.value ? flatten(categoryData.value.tree) : []))
const priceCeiling = computed(() =>
  Math.max(100, ...(data.value?.facets.priceBuckets ?? []).map((bucket) => bucket.max ?? bucket.min)),
)
const priceRange = computed({
  get: () => [Number(minPrice.value) || 0, Number(maxPrice.value) || priceCeiling.value / 100],
  set: (value: number[]) => {
    minPrice.value = String(value[0] ?? 0)
    maxPrice.value = String(value[1] ?? priceCeiling.value / 100)
  },
})
const activeFilters = computed(() => [
  ...attrs.value.map((value) => ({ label: filterLabel(value), key: 'attr' })),
  ...(route.query.q ? [{ label: `Search · ${route.query.q}`, key: 'q' }] : []),
  ...(route.query.categoryId
    ? [
        {
          label:
            categories.value.find((item) => String(item.id) === String(route.query.categoryId))?.name ?? 'Category',
          key: 'categoryId',
        },
      ]
    : []),
  ...(route.query.brand ? [{ label: `Brand · ${route.query.brand}`, key: 'brand' }] : []),
])
function filterLabel(filter: string) {
  const [key = '', value = ''] = filter.split(':')
  return `${attributeLabel(key)}: ${attributeValue(value)}`
}
function add(product: ProductSummary) {
  cart.add(product)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Find your next favourite" description="Pick a category and the filters change to match it." />
    <div class="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="h-fit rounded-xl border border-default bg-elevated/30 p-4">
        <h2 class="text-lg font-bold">Refine results</h2>
        <form class="mt-4 space-y-4" @submit.prevent="submitFilters">
          <UFormField label="Search"><UInput v-model="q" placeholder="Product or keyword" class="w-full" /></UFormField>
          <UFormField label="Category"
            ><select v-model="categoryId" class="w-full rounded-lg border border-default bg-default px-3 py-2 text-sm">
              <option value="">All categories</option>
              <option v-for="category in categories" :key="category.id" :value="String(category.id)">
                {{ '　'.repeat(category.depth) }}{{ category.name }}
              </option>
            </select></UFormField
          >
          <p v-if="categoryStatus === 'pending'" class="text-xs text-muted" role="status">Loading categories…</p>
          <p v-if="categoryLoadError" class="text-xs text-error" role="alert">
            {{ categoryLoadError.message }}
          </p>
          <UFormField label="Brand"
            ><select v-model="brand" class="w-full rounded-lg border border-default bg-default px-3 py-2 text-sm">
              <option value="">Any brand</option>
              <option v-for="facet in data?.facets.brands" :key="facet.value" :value="facet.value">
                {{ facet.value }} ({{ facet.count }})
              </option>
            </select></UFormField
          >
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Min €"
              ><UInput v-model="minPrice" type="number" min="0" step="1" placeholder="0" /></UFormField
            ><UFormField label="Max €"
              ><UInput v-model="maxPrice" type="number" min="0" step="1" placeholder="Any"
            /></UFormField>
          </div>
          <div class="space-y-2 rounded-lg bg-elevated/40 p-3">
            <div class="flex items-center justify-between text-sm">
              <span>Price range</span><span class="text-muted">€{{ priceRange[0] }} – €{{ priceRange[1] }}</span>
            </div>
            <USlider
              v-model="priceRange"
              :min="0"
              :max="Math.ceil(priceCeiling / 100)"
              :step="1"
              :ui="{ root: 'py-2' }"
            />
          </div>
          <div v-for="facet in data?.facets.attributes" :key="facet.key">
            <h3 class="mb-2 text-sm font-semibold">{{ attributeLabel(facet.key) }}</h3>
            <label
              v-for="option in facet.values"
              :key="option.value"
              class="flex cursor-pointer items-center gap-2 py-1 text-sm"
              ><input
                type="checkbox"
                :checked="attrs.includes(`${facet.key}:${option.value}`)"
                @change="toggleAttr(facet.key, option.value)"
              /><span>{{ attributeValue(option.value) }}</span
              ><span class="ml-auto text-muted">{{ option.count }}</span></label
            >
          </div>
          <UButton type="submit" block>Apply filters</UButton>
        </form>
      </aside>
      <section class="min-w-0">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted">{{ data ? formatCount(data.total) : '—' }} products</p>
          <label class="flex items-center gap-2 text-sm"
            >Sort
            <select :value="sort" class="rounded-lg border border-default bg-default px-3 py-2" @change="changeSort">
              <option value="relevance">Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="rating">Top rated</option>
              <option value="newest">Newest</option>
            </select></label
          >
        </div>
        <div v-if="activeFilters.length" class="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
          <UBadge
            v-for="(filter, index) in activeFilters"
            :key="`${filter.key}-${index}`"
            color="primary"
            variant="subtle"
            >{{ filter.label }}</UBadge
          >
          <UButton size="xs" color="neutral" variant="ghost" @click="router.replace({ query: {} })">Clear all</UButton>
        </div>
        <InsightFeatureInsight class="mb-4" feature="search" :trace="data?.trace" />
        <LoadState :status="status" :error="loadError">
          <UPageGrid v-if="data?.items.length" class="gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <ShopProductCard v-for="product in data?.items" :key="product.id" :product="product" @add="add" />
          </UPageGrid>
        </LoadState>
        <p v-if="data && !data.items.length" class="rounded-xl border border-default p-8 text-center text-muted">
          No products match these filters. Adjust the search or clear a filter to try again.
        </p>
        <div
          v-if="data && data.total > data.pageSize"
          class="mt-5 flex items-center justify-between rounded-xl border border-default p-3"
        >
          <span class="text-sm text-muted">Page {{ data.page }} of {{ Math.ceil(data.total / data.pageSize) }}</span>
          <UPagination
            :page="page"
            :items-per-page="data.pageSize"
            :total="data.total"
            @update:page="update({ page: $event })"
          />
        </div>
      </section>
    </div>
  </div>
</template>
