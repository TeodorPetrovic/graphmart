<script setup lang="ts">
import type { ProductSummary } from '#shared/types/api'
import type { CreateReviewResponse, ProductDetailResponse, ProductNetworkResponse } from '#shared/types/api'
import { useActiveUser } from '~/composables/useActiveUser'
import { useCart } from '~/composables/useCart'
import { formatPrice } from '#shared/utils/demo'
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
const reviewStatus = ref('')
async function submitReview() {
  reviewStatus.value = ''
  try {
    await $fetch<CreateReviewResponse>(`/api/catalog/products/${productId.value}/reviews`, {
      method: 'POST',
      body: { userId: userId.value, ...review },
    })
    review.title = ''
    review.body = ''
    await refresh()
    reviewStatus.value = ''
    reviewOpen.value = false
    toast.add({ title: 'Review added', description: 'Thanks for sharing your experience.', color: 'success' })
  } catch (cause) {
    reviewStatus.value = apiErrorMessage(cause, 'Could not submit review.')
  }
}
function addToCart(product: ProductSummary) {
  cart.add(product)
  toast.add({ title: 'Added to cart', description: product.name, color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <LoadState :status="status" :error="loadError"
      ><template v-if="data"
        ><UBreadcrumb
          :items="[
            { label: 'Browse', to: '/shop' },
            ...data.product.breadcrumbs.map((crumb) => ({ label: crumb.name, to: `/shop?categoryId=${crumb.id}` })),
            { label: data.product.name },
          ]" />
        <section class="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article class="rounded-2xl border border-default bg-elevated/30 p-6">
            <p class="font-semibold text-primary">
              {{ data.product.brand }} <span class="text-muted">· {{ data.product.sku }}</span>
            </p>
            <h2 class="mt-2 text-3xl font-bold">{{ data.product.name }}</h2>
            <p class="mt-3 text-muted">{{ data.product.description }}</p>
            <InsightFeatureInsight class="mt-4" feature="productPage" :trace="data.trace" />
            <div class="mt-5 flex flex-wrap items-center gap-4">
              <span class="text-3xl font-bold">{{ formatPrice(data.product.priceCents) }}</span><span
                class="text-sm text-muted"
                >★ {{ data.product.rating.toFixed(1) }} · {{ data.product.ratingCount }} reviews</span
              ><span class="text-sm text-muted">{{ data.product.stock }} available</span>
            </div>
            <UButton class="mt-5" icon="i-lucide-shopping-bag" @click="addToCart(data.product)">Add to cart</UButton>
            <div class="mt-7">
              <h3 class="text-xl font-bold">Specifications</h3>
              <dl class="mt-3 divide-y divide-default rounded-lg border border-default">
                <div
                  v-for="[key, value] in Object.entries(data.product.attributes)"
                  :key="key"
                  class="grid grid-cols-2 gap-3 px-4 py-2 text-sm"
                >
                  <dt class="font-semibold">{{ attributeLabel(key) }}</dt>
                  <dd class="text-muted">{{ attributeValue(value) }}</dd>
                </div>
              </dl>
            </div>
            <div class="mt-5 flex flex-wrap gap-2">
              <UBadge v-for="tag in data.product.tags" :key="tag" color="neutral" variant="subtle">{{ tag }}</UBadge>
            </div>
          </article>
          <aside class="space-y-4">
            <section class="rounded-2xl border border-default p-5">
              <h3 class="text-xl font-bold">Often bought together</h3>
              <InsightFeatureInsight class="mt-3" feature="alsoBought" :trace="data.trace" />
              <ul class="mt-3 divide-y divide-default">
                <li v-for="recommendation in data.alsoBought" :key="recommendation.product.id" class="py-3">
                  <NuxtLink :to="`/shop/${recommendation.product.id}`" class="font-semibold hover:text-primary">{{
                    recommendation.product.name
                  }}</NuxtLink>
                  <p class="text-sm text-muted">
                    {{ recommendation.reasons.join(' · ') }} · {{ formatPrice(recommendation.product.priceCents) }}
                  </p>
                </li>
                <li v-if="!data.alsoBought.length" class="py-3 text-sm text-muted">
                  No suggestions for this product yet.
                </li>
              </ul>
            </section>
          </aside>
        </section>
        <section class="rounded-2xl border border-default p-5">
          <h3 class="text-xl font-bold">People you know who bought this</h3>
          <p class="mt-1 text-sm text-muted">
            {{ network.data.value?.totalInNetwork ?? '—' }} shoppers in your circle bought it.
          </p>
          <InsightFeatureInsight class="mt-3" feature="socialProof" :trace="network.data.value?.trace" />
          <LoadState :status="network.status.value" :error="network.error.value"
            ><div v-if="network.data.value?.buyers.length" class="mt-4 flex flex-wrap gap-3">
              <div
                v-for="buyer in network.data.value.buyers"
                :key="buyer.user.id"
                class="flex items-center gap-2 rounded-xl bg-elevated/50 px-3 py-2"
              >
                <UAvatar :alt="buyer.user.name" size="sm" />
                <div>
                  <p class="text-sm font-semibold">{{ buyer.user.name }}</p>
                  <p class="text-xs text-muted">
                    {{ buyer.distance === 1 ? 'You follow them' : `Through ${buyer.via.join(', ')}` }}
                  </p>
                </div>
              </div>
            </div>
            <UEmpty
              v-else
              title="No buyers in your circle yet"
              description="This product may still be popular with other shoppers."
          /></LoadState>
          <details v-if="network.data.value?.graph.nodes.length" class="mt-4 rounded-xl border border-default p-4">
            <summary class="cursor-pointer font-semibold">Show connections</summary>
            <GraphView class="mt-4" :graph="network.data.value.graph" height="320px" />
          </details>
        </section>
        <section class="rounded-2xl border border-default p-5">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-xl font-bold">Customer reviews</h3>
            <UButton size="sm" icon="i-lucide-pen-line" @click="reviewOpen = true">Add review</UButton>
          </div>
          <UModal v-model:open="reviewOpen" title="Write a review" description="Tell other shoppers what you think.">
            <template #body
              ><form class="space-y-3" @submit.prevent="submitReview">
                <UFormField label="Rating"
                  ><select
                    v-model.number="review.rating"
                    class="w-full rounded-lg border border-default bg-default px-3 py-2"
                  >
                    <option v-for="rating in [5, 4, 3, 2, 1]" :key="rating" :value="rating">{{ rating }} stars</option>
                  </select></UFormField
                ><UFormField label="Title"
                  ><UInput v-model="review.title" required maxlength="120" class="w-full" /></UFormField
                ><UFormField label="Review"
                  ><UTextarea v-model="review.body" required maxlength="2000" class="w-full" /></UFormField
                ><UButton type="submit">Submit review</UButton>
                <p v-if="reviewStatus" role="status" class="text-sm text-muted">{{ reviewStatus }}</p>
              </form></template
            ></UModal
          >
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <article v-for="item in data.reviews" :key="item.id" class="rounded-lg bg-elevated/40 p-4">
              <div class="flex justify-between gap-2">
                <h4 class="font-semibold">{{ item.title }}</h4>
                <span class="text-sm">★ {{ item.rating }}</span>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ item.userName }} · {{ formatTimestamp(item.createdAt).slice(0, 10) }}
              </p>
              <p class="mt-3 text-sm">{{ item.body }}</p>
            </article>
          </div>
          <UEmpty
            v-if="!data.reviews.length"
            class="mt-2"
            title="No reviews yet"
            description="Be the first to share a review."
          /></section></template
    ></LoadState>
  </div>
</template>
