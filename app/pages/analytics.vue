<script setup lang="ts">
import type { AnalyticsResponse } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'

const { data, status, error } = await useFetch<AnalyticsResponse>('/api/analytics/dashboard')
const totals = computed(() => {
  const months = data.value?.revenueByMonth ?? []
  return [
    { label: 'Revenue', value: formatPrice(months.at(-1)?.runningTotalCents ?? 0) },
    { label: 'Orders', value: formatCount(months.reduce((sum, month) => sum + month.orders, 0)) },
  ]
})
const months = computed(() =>
  (data.value?.revenueByMonth.slice(-24) ?? []).map((item) => ({
    label: item.month,
    value: item.revenueCents,
    display: formatPrice(item.revenueCents),
  })),
)
const categories = computed(() =>
  (data.value?.topCategories ?? []).map((item) => ({
    label: item.name,
    value: item.revenueCents,
    display: formatPrice(item.revenueCents),
  })),
)
const ratings = computed(() =>
  (data.value?.ratingDistribution ?? []).map((item) => ({
    label: `${item.rating} stars`,
    value: item.count,
    display: formatCount(item.count),
  })),
)
</script>

<template>
  <LoadState :status="status" :error="error">
    <div v-if="data" class="space-y-8">
      <div class="space-y-3">
        <InsightFeatureInsight class="justify-end" feature="analytics" :trace="data.trace" />
        <StatRow :stats="totals" />
      </div>
      <div class="grid gap-8 lg:grid-cols-2">
        <PageSection title="Revenue by month, last 24">
          <BarList :rows="months" />
        </PageSection>
        <div class="space-y-8">
          <PageSection title="Revenue by category">
            <BarList :rows="categories" />
          </PageSection>
          <PageSection title="Reviews by rating">
            <BarList :rows="ratings" />
          </PageSection>
        </div>
        <PageSection title="Most viewed products">
          <DataTable
            :rows="data.mostViewed"
            :columns="[
              { key: 'name', label: 'Product' },
              { key: 'views', label: 'Views', align: 'right' },
            ]"
            :row-key="(product) => product.productId"
          >
            <template #name="{ row }">
              <ULink :to="`/shop/${row.productId}`" class="text-default hover:underline">{{ row.name }}</ULink>
            </template>
            <template #views="{ row }">{{ formatCount(row.views) }}</template>
          </DataTable>
        </PageSection>
        <PageSection title="Customers who spent the most">
          <DataTable
            :rows="data.topCustomers"
            :columns="[
              { key: 'name', label: 'Customer' },
              { key: 'orders', label: 'Orders', align: 'right' },
              { key: 'spentCents', label: 'Spent', align: 'right' },
            ]"
            :row-key="(customer) => customer.userId"
          >
            <template #spentCents="{ row }">{{ formatPrice(row.spentCents) }}</template>
          </DataTable>
        </PageSection>
      </div>
    </div>
  </LoadState>
</template>
