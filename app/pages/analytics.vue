<script setup lang="ts">
import type { AnalyticsResponse } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'

const { data, status, error } = await useFetch<AnalyticsResponse>('/api/analytics/dashboard')
const months = computed(() => data.value?.revenueByMonth.slice(-24) ?? [])
const maxRevenue = computed(() => Math.max(1, ...months.value.map((item) => item.revenueCents)))
const maxCategory = computed(() => Math.max(1, ...(data.value?.topCategories.map((item) => item.revenueCents) ?? [1])))
const maxRating = computed(() => Math.max(1, ...(data.value?.ratingDistribution.map((item) => item.count) ?? [1])))
const totalRevenue = computed(() => data.value?.revenueByMonth.at(-1)?.runningTotalCents ?? 0)
const totalOrders = computed(() => data.value?.revenueByMonth.reduce((sum, month) => sum + month.orders, 0) ?? 0)
const views = computed(() => data.value?.mostViewed.reduce((sum, product) => sum + product.views, 0) ?? 0)
</script>

<template>
  <main class="space-y-6 p-6 lg:p-8">
    <PageHeader
      eyebrow="Store team"
      title="Store insights"
      description="A clear view of recent sales, customer favorites and product feedback."
    />
    <InsightFeatureInsight feature="analytics" :trace="data?.trace" />
    <LoadState :status="status" :error="error"
      ><template v-if="data">
        <UPageGrid class="grid-cols-1 md:grid-cols-3"
          ><UCard
            ><p class="text-sm text-muted">Revenue to date</p>
            <p class="mt-2 text-3xl font-bold">{{ formatPrice(totalRevenue) }}</p></UCard
          ><UCard
            ><p class="text-sm text-muted">Orders in report</p>
            <p class="mt-2 text-3xl font-bold">{{ formatCount(totalOrders) }}</p></UCard
          ><UCard
            ><p class="text-sm text-muted">Views across top products</p>
            <p class="mt-2 text-3xl font-bold">{{ formatCount(views) }}</p></UCard
          ></UPageGrid
        >
        <section class="grid gap-4 xl:grid-cols-2">
          <UCard
            ><template #header
              ><div>
                <h2 class="text-xl font-semibold">Revenue by month</h2>
                <p class="text-sm text-muted">Most recent 24 months</p>
              </div></template
            >
            <div v-if="months.length" class="max-h-[470px] space-y-3 overflow-auto pr-2">
              <div
                v-for="item in months"
                :key="item.month"
                class="grid grid-cols-[5.5rem_minmax(4rem,1fr)_7rem] items-center gap-3 text-sm"
              >
                <span>{{ item.month }}</span><UProgress :model-value="(item.revenueCents / maxRevenue) * 100" /><span
                  class="text-right tabular-nums"
                  >{{ formatPrice(item.revenueCents) }}</span
                >
              </div>
            </div>
            <UEmpty v-else icon="i-lucide-chart-no-axes-column-increasing" title="No sales history yet"
          /></UCard>
          <UCard
            ><template #header
              ><div>
                <h2 class="text-xl font-semibold">Top categories</h2>
                <p class="text-sm text-muted">Sales by category</p>
              </div></template
            >
            <div v-if="data.topCategories.length" class="space-y-4">
              <div v-for="item in data.topCategories" :key="item.categoryId">
                <div class="mb-1 flex justify-between gap-3 text-sm">
                  <span class="font-medium">{{ item.name }} · {{ formatCount(item.units) }} items</span
                  ><span>{{ formatPrice(item.revenueCents) }}</span>
                </div>
                <UProgress :model-value="(item.revenueCents / maxCategory) * 100" color="success" />
              </div>
            </div>
            <UEmpty v-else icon="i-lucide-tags" title="No category sales yet"
          /></UCard>
          <UCard
            ><template #header
              ><div>
                <h2 class="text-xl font-semibold">Customer ratings</h2>
                <p class="text-sm text-muted">Reviews by star rating</p>
              </div></template
            >
            <div v-if="data.ratingDistribution.length" class="space-y-3">
              <div
                v-for="item in data.ratingDistribution"
                :key="item.rating"
                class="grid grid-cols-[4rem_1fr_3rem] items-center gap-3"
              >
                <span>{{ item.rating }} stars</span
                ><UProgress :model-value="(item.count / maxRating) * 100" color="warning" /><span
                  class="text-right tabular-nums"
                  >{{ item.count }}</span
                >
              </div>
            </div>
            <UEmpty v-else icon="i-lucide-star" title="No reviews yet"
          /></UCard>
          <UCard
            ><template #header
              ><div>
                <h2 class="text-xl font-semibold">Most viewed</h2>
                <p class="text-sm text-muted">Products shoppers are looking at</p>
              </div></template
            >
            <ol v-if="data.mostViewed.length" class="divide-y divide-default">
              <li v-for="(item, index) in data.mostViewed" :key="item.productId" class="flex items-center gap-3 py-3">
                <UBadge color="neutral" variant="subtle">{{ index + 1 }}</UBadge><NuxtLink
                  :to="`/shop/${item.productId}`"
                  class="grow font-medium hover:text-primary"
                  >{{ item.name }}</NuxtLink
                ><span class="text-sm text-muted">{{ formatCount(item.views) }} views</span>
              </li>
            </ol>
            <UEmpty v-else icon="i-lucide-eye" title="No product views yet"
          /></UCard>
          <UCard class="xl:col-span-2"
            ><template #header
              ><div>
                <h2 class="text-xl font-semibold">Top customers</h2>
                <p class="text-sm text-muted">Most valuable customers by total spend</p>
              </div></template
            >
            <div v-if="data.topCustomers.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="customer in data.topCustomers"
                :key="customer.userId"
                class="flex items-center gap-3 rounded-lg bg-elevated/50 p-3"
              >
                <UAvatar :alt="customer.name" />
                <div class="min-w-0 grow">
                  <p class="truncate font-medium">{{ customer.name }}</p>
                  <p class="text-sm text-muted">{{ customer.orders }} orders</p>
                </div>
                <p class="font-semibold">{{ formatPrice(customer.spentCents) }}</p>
              </div>
            </div>
            <UEmpty v-else icon="i-lucide-user-round" title="No customer totals yet"
          /></UCard>
        </section> </template
    ></LoadState>
  </main>
</template>
