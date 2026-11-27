<script setup lang="ts">
import type {
  RecommendationsResponse,
  SuggestionsResponse,
  UserOrdersResponse,
  UserProfileResponse,
} from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'

const userId = useActiveUser()
const profilePath = computed(() => `/api/users/${userId.value}`)
const orderPath = computed(() => `/api/users/${userId.value}/orders`)
const social = useFetch<RecommendationsResponse>(() => `/api/recommendations/${userId.value}`, {
  query: { strategy: 'social', limit: 6 },
  watch: [userId],
})
const similar = useFetch<RecommendationsResponse>(() => `/api/recommendations/${userId.value}`, {
  query: { strategy: 'collaborative', limit: 6 },
  watch: [userId],
})
const category = useFetch<RecommendationsResponse>(() => `/api/recommendations/${userId.value}`, {
  query: { strategy: 'category', limit: 6 },
  watch: [userId],
})
const profile = useFetch<UserProfileResponse>(() => profilePath.value, { watch: [userId] })
const orders = useFetch<UserOrdersResponse>(() => orderPath.value, { watch: [userId] })
const suggestions = useFetch<SuggestionsResponse>(() => `/api/social/${userId.value}/suggestions`, {
  query: { limit: 4 },
  watch: [userId],
})
/** The people whose purchases led to this product, taken from the explanation graph. */
function buyersOf(productId: number) {
  const graph = social.data.value?.graph
  if (!graph) return []
  const buyers = new Set(
    graph.edges.filter((edge) => edge.target === `Product:${productId}`).map((edge) => edge.source),
  )
  return graph.nodes.filter((node) => buyers.has(node.id))
}
const newestOrder = computed(() => orders.data.value?.orders[0])
</script>

<template>
  <div class="space-y-8">
    <header class="rounded-3xl bg-gradient-to-br from-primary/15 via-elevated to-elevated p-7 sm:p-10">
      <p class="text-sm font-semibold text-primary">A little inspiration, picked for you</p>
      <h2 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {{
          profile.data.value?.user.name
            ? `Good to see you, ${profile.data.value.user.name.split(' ')[0]}`
            : 'Welcome back'
        }}
      </h2>
      <p class="mt-2 max-w-2xl text-base leading-relaxed text-muted">
        Find things people you trust love, revisit what caught your eye, and pick up where you left off.
      </p>
      <UButton to="/shop" icon="i-lucide-search" class="mt-5">Browse the shop</UButton>
    </header>

    <section class="space-y-4">
      <h2 class="text-2xl font-bold">Bought by people in your circle</h2>
      <InsightFeatureInsight feature="forYou" :trace="social.data.value?.trace" />
      <LoadState :status="social.status.value" :error="social.error.value">
        <UPageGrid v-if="social.data.value?.items.length" class="gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="item in social.data.value.items" :key="item.product.id">
            <div class="flex items-center gap-2">
              <UAvatarGroup size="sm" :max="3">
                <UAvatar v-for="person in buyersOf(item.product.id)" :key="person.id" :alt="person.label" />
              </UAvatarGroup>
              <span class="text-sm text-muted">In your network</span>
            </div>
            <p class="mt-4 text-sm font-semibold text-primary">{{ item.product.brand }}</p>
            <NuxtLink :to="`/shop/${item.product.id}`" class="mt-1 block text-lg font-bold hover:text-primary">{{
              item.product.name
            }}</NuxtLink>
            <p class="mt-2 min-h-10 text-sm text-muted">
              {{ item.reasons.join(' · ') || 'Popular with people in your circle' }}
            </p>
            <div class="mt-4 flex items-center justify-between">
              <strong>{{ formatPrice(item.product.priceCents) }}</strong>
              <UButton :to="`/shop/${item.product.id}`" color="neutral" variant="soft">View product</UButton>
            </div>
          </UCard>
        </UPageGrid>
        <UEmpty v-else title="No social picks yet" description="Follow a few people to see what they enjoy." />
      </LoadState>
    </section>

    <div class="grid gap-8 xl:grid-cols-2">
      <section class="space-y-4">
        <div class="flex items-end justify-between gap-2">
          <div>
            <p class="text-sm text-muted">Similar shoppers also chose</p>
            <h2 class="text-xl font-bold">Shoppers like you</h2>
          </div>
        </div>
        <LoadState :status="similar.status.value" :error="similar.error.value">
          <div v-if="similar.data.value?.items.length" class="grid gap-3 sm:grid-cols-2">
            <UCard v-for="item in similar.data.value.items.slice(0, 4)" :key="item.product.id">
              <NuxtLink :to="`/shop/${item.product.id}`" class="font-semibold hover:text-primary">{{
                item.product.name
              }}</NuxtLink>
              <p class="mt-1 text-sm text-muted">{{ item.reasons.join(' · ') }}</p>
              <p class="mt-3 font-bold">{{ formatPrice(item.product.priceCents) }}</p>
            </UCard>
          </div>
          <UEmpty
            v-else
            title="Nothing to show yet"
            description="Your picks will appear as the shop learns your interests."
          />
        </LoadState>
      </section>
      <section class="space-y-4">
        <div class="flex items-end justify-between gap-2">
          <div>
            <p class="text-sm text-muted">Based on your interests</p>
            <h2 class="text-xl font-bold">More of what you look at</h2>
          </div>
        </div>
        <LoadState :status="category.status.value" :error="category.error.value">
          <div v-if="category.data.value?.items.length" class="grid gap-3 sm:grid-cols-2">
            <UCard v-for="item in category.data.value.items.slice(0, 4)" :key="item.product.id">
              <NuxtLink :to="`/shop/${item.product.id}`" class="font-semibold hover:text-primary">{{
                item.product.name
              }}</NuxtLink>
              <p class="mt-1 text-sm text-muted">{{ item.reasons.join(' · ') }}</p>
              <p class="mt-3 font-bold">{{ formatPrice(item.product.priceCents) }}</p>
            </UCard>
          </div>
          <UEmpty
            v-else
            title="No related picks yet"
            description="Explore a few products to build your recommendations."
          />
        </LoadState>
      </section>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <UCard>
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-muted">Your circle</p>
            <h2 class="text-xl font-bold">People you may know</h2>
          </div>
          <UButton to="/social" color="neutral" variant="outline">Meet people</UButton>
        </div>
        <div v-if="suggestions.data.value?.suggestions.length" class="mt-4 flex flex-wrap gap-3">
          <div
            v-for="person in suggestions.data.value.suggestions"
            :key="person.user.id"
            class="flex items-center gap-2 rounded-full bg-elevated px-3 py-2"
          >
            <UAvatar :alt="person.user.name" size="sm" /><span class="text-sm">{{ person.user.name }}</span>
            <UBadge color="neutral" variant="subtle">{{ person.mutualCount }} mutual</UBadge>
          </div>
        </div>
        <p v-else-if="suggestions.status.value === 'pending'" class="mt-3 text-sm text-muted">
          Finding people you may know…
        </p>
        <p v-else class="mt-3 text-sm text-muted">See people connected to your interests in the community.</p>
      </UCard>
      <UCard>
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-muted">Last time at GraphMart</p>
            <h2 class="text-xl font-bold">Your recent order</h2>
          </div>
          <UButton to="/orders" color="neutral" variant="outline">Order history</UButton>
        </div>
        <template v-if="newestOrder"
          ><p class="mt-3 font-semibold">Order #{{ newestOrder.id }}</p>
          <p class="mt-1 text-sm text-muted">{{ newestOrder.items.map((item) => item.name).join(', ') }}</p>
          <p class="mt-3 font-bold">{{ formatPrice(newestOrder.totalCents) }}</p></template
        >
        <p v-else class="mt-3 text-sm text-muted">Your first order will show up here.</p>
      </UCard>
    </div>
  </div>
</template>
