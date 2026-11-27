<script setup lang="ts">
import type {
  CreateReviewResponse,
  ProductDetailResponse,
  ProductNetworkResponse,
  ProductSummary,
} from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'
import { useCart } from '~/composables/useCart'

const route = useRoute()
const userId = useActiveUser()
const cart = useCart()
const toast = useToast()
const productId = computed(() => Number(route.params.id))
const { data, status, error, refresh } = useFetch<ProductDetailResponse>(
  () => `/api/catalog/products/${productId.value}`,
  { query: { userId } },
)
const loadError = useLoadError(error)
const network = useFetch<ProductNetworkResponse>(() => `/api/catalog/products/${productId.value}/network`, {
  query: { userId },
  watch: [productId, userId],
})

const reviewOpen = ref(false)
const review = reactive({ rating: 5, title: '', body: '' })
const reviewError = ref('')
async function submitReview() {
  reviewError.value = ''
  try {
    await $fetch<CreateReviewResponse>(`/api/catalog/products/${productId.value}/reviews`, {
      method: 'POST',
      body: { userId: userId.value, ...review },
    })
    review.title = ''
    review.body = ''
    await refresh()
    reviewOpen.value = false
    toast.add({ title: 'Review added' })
  } catch (cause) {
    reviewError.value = apiErrorMessage(cause, 'Could not add the review.')
  }
}
function addToCart(product: ProductSummary) {
  cart.add(product)
  toast.add({ title: 'Added to cart', description: product.name })
}
</script>

<template>
  <LoadState :status="status" :error="loadError">
    <div v-if="data" class="space-y-8">
      <UBreadcrumb
        :items="[
          { label: 'Products', to: '/shop' },
          ...data.product.breadcrumbs.map((crumb) => ({ label: crumb.name, to: `/shop?categoryId=${crumb.id}` })),
        ]"
      />
      <div class="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div class="space-y-4">
          <div>
            <h2 class="text-2xl font-semibold">{{ data.product.name }}</h2>
            <p class="text-sm text-muted">{{ data.product.brand }}, {{ data.product.sku }}</p>
          </div>
          <p>{{ data.product.description }}</p>
          <div class="flex flex-wrap items-center gap-4">
            <span class="text-2xl font-semibold tabular-nums">{{ formatPrice(data.product.priceCents) }}</span>
            <UButton :disabled="!data.product.stock" @click="addToCart(data.product)">Add to cart</UButton>
            <span class="text-sm text-muted">
              {{ data.product.stock ? `${data.product.stock} in stock` : 'Out of stock' }}. Rated
              {{ data.product.rating.toFixed(1) }} from {{ data.product.ratingCount }} reviews.
            </span>
          </div>
          <PageSection title="Specifications">
            <template #aside><InsightFeatureInsight feature="productPage" :trace="data.trace" /></template>
            <dl class="divide-y divide-default border-y border-default text-sm">
              <div v-for="(value, key) in data.product.attributes" :key="key" class="grid grid-cols-2 gap-3 py-2">
                <dt class="text-muted">{{ attributeLabel(String(key)) }}</dt>
                <dd>{{ attributeValue(value) }}</dd>
              </div>
            </dl>
            <p class="text-sm text-muted">Tags: {{ data.product.tags.join(', ') }}</p>
          </PageSection>
        </div>
        <PageSection title="Buyers also bought">
          <template #aside><InsightFeatureInsight feature="alsoBought" :trace="data.trace" /></template>
          <ProductList :items="data.alsoBought" empty="No other purchases to show." />
        </PageSection>
      </div>

      <PageSection title="People you know who bought this">
        <template #aside>
          <InsightFeatureInsight feature="socialProof" :trace="network.data.value?.trace" />
        </template>
        <LoadState :status="network.status.value" :error="network.error.value">
          <p class="text-sm text-muted">
            {{ network.data.value?.totalInNetwork ?? 0 }} people in your network bought it.
          </p>
          <DataTable
            :rows="network.data.value?.buyers ?? []"
            :columns="[
              { key: 'user', label: 'Name' },
              { key: 'via', label: 'How you know them' },
            ]"
            :row-key="(buyer) => buyer.user.id"
            empty="Nobody you know has bought it."
          >
            <template #user="{ row }">{{ row.user.name }}</template>
            <template #via="{ row }">
              {{ row.distance === 1 ? 'You follow them' : `Through ${row.via.join(', ')}` }}
            </template>
          </DataTable>
          <details v-if="network.data.value?.graph.nodes.length" class="mt-3 text-sm">
            <summary class="cursor-pointer underline">Show as a graph</summary>
            <GraphView class="mt-3" :graph="network.data.value.graph" height="320px" />
          </details>
        </LoadState>
      </PageSection>

      <PageSection title="Reviews">
        <template #aside>
          <UModal v-model:open="reviewOpen" title="Write a review">
            <UButton size="sm" color="neutral" variant="outline">Write a review</UButton>
            <template #body>
              <form class="space-y-3" @submit.prevent="submitReview">
                <UFormField label="Rating">
                  <USelect
                    v-model="review.rating"
                    :items="[5, 4, 3, 2, 1].map((value) => ({ label: `${value} out of 5`, value }))"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Title">
                  <UInput v-model="review.title" required maxlength="120" class="w-full" />
                </UFormField>
                <UFormField label="Review">
                  <UTextarea v-model="review.body" required maxlength="2000" class="w-full" />
                </UFormField>
                <UAlert v-if="reviewError" color="error" variant="subtle" :description="reviewError" />
                <UButton type="submit">Save review</UButton>
              </form>
            </template>
          </UModal>
        </template>
        <ul v-if="data.reviews.length" class="divide-y divide-default border-y border-default">
          <li v-for="item in data.reviews" :key="item.id" class="py-3 text-sm">
            <p class="font-medium">{{ item.title }}</p>
            <p>{{ item.body }}</p>
            <p class="text-muted">
              {{ item.rating }} out of 5, {{ item.userName }}, {{ formatTimestamp(item.createdAt).slice(0, 10) }}
            </p>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">No reviews yet.</p>
      </PageSection>
    </div>
  </LoadState>
</template>
