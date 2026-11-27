<script setup lang="ts">
import type { RecommendationsResponse } from '#shared/types/api'
import { useActiveUser } from '~/composables/useActiveUser'

const userId = useActiveUser()
function recommendations(strategy: 'social' | 'collaborative' | 'category', limit: number) {
  return useFetch<RecommendationsResponse>(() => `/api/recommendations/${userId.value}`, {
    query: { strategy, limit },
    watch: [userId],
  })
}
const social = recommendations('social', 6)
const similar = recommendations('collaborative', 4)
const category = recommendations('category', 4)
</script>

<template>
  <div class="space-y-8">
    <PageSection title="Bought by people you follow, or people they follow">
      <template #aside><InsightFeatureInsight feature="forYou" :trace="social.data.value?.trace" /></template>
      <LoadState :status="social.status.value" :error="social.error.value">
        <ProductList
          :items="social.data.value?.items ?? []"
          empty="No purchases in your network yet. Follow some people first."
        />
      </LoadState>
    </PageSection>

    <div class="grid gap-8 lg:grid-cols-2">
      <PageSection title="Bought by shoppers with similar orders">
        <LoadState :status="similar.status.value" :error="similar.error.value">
          <ProductList :items="similar.data.value?.items ?? []" empty="Not enough orders to compare yet." />
        </LoadState>
      </PageSection>
      <PageSection title="From categories you view">
        <LoadState :status="category.status.value" :error="category.error.value">
          <ProductList :items="category.data.value?.items ?? []" empty="View a few products first." />
        </LoadState>
      </PageSection>
    </div>
  </div>
</template>
