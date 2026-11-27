<script setup lang="ts">
import type { CategoryTreeResponse, ProductSearchResponse, ProductSummary } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'
import type { LocationQueryRaw } from 'vue-router'
import { useCart } from '~/composables/useCart'

/** Select menus cannot hold an empty string, so "no filter" needs its own value. */
const ANY = '__any'
const SORTS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price, low to high', value: 'price_asc' },
  { label: 'Price, high to low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
  { label: 'Newest', value: 'newest' },
]

const route = useRoute()
const router = useRouter()
const cart = useCart()
const toast = useToast()
const { data: categoryData, error: categoryError } = useFetch<CategoryTreeResponse>('/api/catalog/categories')
const categoryLoadError = useLoadError(categoryError)

function priceQueryToInput(value: unknown): string {
  const cents = Number(value)
  return value === undefined || value === null || !Number.isFinite(cents) ? '' : String(cents / 100)
}
function formFromRoute() {
  const text = (value: unknown) => String(value ?? '')
  return {
    q: text(route.query.q),
    categoryId: text(route.query.categoryId) || ANY,
    brand: text(route.query.brand) || ANY,
    minPrice: priceQueryToInput(route.query.minPrice),
    maxPrice: priceQueryToInput(route.query.maxPrice),
  }
}
const form = reactive(formFromRoute())
watch(
  () => route.query,
  () => Object.assign(form, formFromRoute()),
)

const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))
const attrs = computed(() => [route.query.attr ?? []].flat().map(String))
const query = computed(() => ({ ...route.query, attr: attrs.value }))
const { data, status, error } = useFetch<ProductSearchResponse>('/api/catalog/products', { query, watch: [query] })
const loadError = useLoadError(error)

function update(patch: Record<string, string | number | string[]>) {
  const next: LocationQueryRaw = { ...route.query, page: 1, ...patch }
  const kept = Object.entries(next).filter(([, value]) => value !== '' && value !== ANY && value !== undefined)
  router.replace({ query: Object.fromEntries(kept) })
}
function submitFilters() {
  const toCents = (euros: string) => (euros === '' ? '' : String(Math.round(Number(euros) * 100)))
  update({ ...form, minPrice: toCents(String(form.minPrice)), maxPrice: toCents(String(form.maxPrice)) })
}
function toggleAttr(item: string) {
  update({ attr: attrs.value.includes(item) ? attrs.value.filter((a) => a !== item) : [...attrs.value, item] })
}

function flatten(nodes: CategoryTreeResponse['tree'], depth = 0): { label: string; value: string }[] {
  return nodes.flatMap((node) => [
    { label: `${' '.repeat(depth)}${node.name}`, value: String(node.id) },
    ...flatten(node.children, depth + 1),
  ])
}
const categories = computed(() => [
  { label: 'All categories', value: ANY },
  ...(categoryData.value ? flatten(categoryData.value.tree) : []),
])
const brands = computed(() => [
  { label: 'Any brand', value: ANY },
  ...(data.value?.facets.brands ?? []).map((facet) => ({
    label: `${facet.value} (${facet.count})`,
    value: facet.value,
  })),
])
function add(product: ProductSummary) {
  cart.add(product)
  toast.add({ title: 'Added to cart', description: product.name })
}
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <form class="space-y-4" aria-label="Filters" @submit.prevent="submitFilters">
      <UFormField label="Search">
        <UInput v-model="form.q" placeholder="Name or keyword" class="w-full" />
      </UFormField>
      <UFormField label="Category" :error="categoryLoadError?.message">
        <USelect
          :model-value="form.categoryId"
          :items="categories"
          class="w-full"
          @update:model-value="update({ categoryId: String($event), attr: [] })"
        />
      </UFormField>
      <UFormField label="Brand">
        <USelect
          :model-value="form.brand"
          :items="brands"
          class="w-full"
          @update:model-value="update({ brand: String($event) })"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-2">
        <UFormField label="Min price (€)">
          <UInput v-model="form.minPrice" type="number" min="0" />
        </UFormField>
        <UFormField label="Max price (€)">
          <UInput v-model="form.maxPrice" type="number" min="0" />
        </UFormField>
      </div>
      <div class="flex gap-2">
        <UButton type="submit">Apply</UButton>
        <UButton color="neutral" variant="ghost" @click="router.replace({ query: {} })">Clear</UButton>
      </div>
      <fieldset v-for="facet in data?.facets.attributes" :key="facet.key" class="space-y-1">
        <legend class="mb-1 text-sm font-medium">{{ attributeLabel(facet.key) }}</legend>
        <UCheckbox
          v-for="option in facet.values"
          :key="option.value"
          :model-value="attrs.includes(`${facet.key}:${option.value}`)"
          :label="`${attributeValue(option.value)} (${option.count})`"
          @update:model-value="toggleAttr(`${facet.key}:${option.value}`)"
        />
      </fieldset>
    </form>

    <div class="min-w-0 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium tabular-nums">{{ data ? `${formatCount(data.total)} products` : 'Loading' }}</p>
        <div class="flex flex-wrap items-center gap-4">
          <InsightFeatureInsight feature="search" :trace="data?.trace" />
          <USelect
            :model-value="String(route.query.sort ?? 'relevance')"
            :items="SORTS"
            aria-label="Sort by"
            class="w-44"
            @update:model-value="update({ sort: String($event) })"
          />
        </div>
      </div>
      <LoadState :status="status" :error="loadError">
        <DataTable
          :rows="data?.items ?? []"
          :columns="[
            { key: 'name', label: 'Product' },
            { key: 'rating', label: 'Rating', align: 'right' },
            { key: 'stock', label: 'Stock', align: 'right' },
            { key: 'priceCents', label: 'Price', align: 'right' },
            { key: 'add', label: '', align: 'right' },
          ]"
          :row-key="(product) => product.id"
          empty="No products match these filters."
        >
          <template #name="{ row }">
            <ULink :to="`/shop/${row.id}`" class="font-medium text-default hover:underline">{{ row.name }}</ULink>
            <p class="text-muted">{{ row.brand }}</p>
          </template>
          <template #rating="{ row }">{{ row.rating.toFixed(1) }} ({{ row.ratingCount }})</template>
          <template #priceCents="{ row }">{{ formatPrice(row.priceCents) }}</template>
          <template #add="{ row }">
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              :disabled="!row.stock"
              :aria-label="`Add ${row.name} to cart`"
              @click="add(row)"
            >
              Add
            </UButton>
          </template>
        </DataTable>
      </LoadState>
      <UPagination
        v-if="data && data.total > data.pageSize"
        :page="page"
        :items-per-page="data.pageSize"
        :total="data.total"
        @update:page="update({ page: $event })"
      />
    </div>
  </div>
</template>
