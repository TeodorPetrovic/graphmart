<script setup lang="ts">
import type { UserOrdersResponse, UserProfileResponse } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'

const userId = useActiveUser()
const profile = useFetch<UserProfileResponse>(() => `/api/users/${userId.value}`, { watch: [userId] })
const orders = useFetch<UserOrdersResponse>(() => `/api/users/${userId.value}/orders`, { watch: [userId] })
const loadError = useLoadError(orders.error)
</script>

<template>
  <PageSection :title="profile.data.value ? `Orders by ${profile.data.value.user.name}` : 'Orders'">
    <template #aside><InsightFeatureInsight feature="orders" :trace="orders.data.value?.trace" /></template>
    <p v-if="profile.data.value" class="text-sm text-muted">
      {{ profile.data.value.user.email }}, {{ profile.data.value.user.city }}. {{ profile.data.value.user.tier }} tier.
    </p>
    <LoadState :status="orders.status.value" :error="loadError">
      <DataTable
        :rows="orders.data.value?.orders ?? []"
        :columns="[
          { key: 'id', label: 'Order' },
          { key: 'createdAt', label: 'Date' },
          { key: 'items', label: 'Items' },
          { key: 'status', label: 'Status' },
          { key: 'totalCents', label: 'Total', align: 'right' },
        ]"
        :row-key="(order) => order.id"
        empty="No orders yet."
      >
        <template #id="{ row }">#{{ row.id }}</template>
        <template #createdAt="{ row }">
          <span class="whitespace-nowrap">{{ formatTimestamp(row.createdAt).slice(0, 10) }}</span>
        </template>
        <template #items="{ row }">
          <p v-for="item in row.items" :key="item.productId">
            {{ item.quantity }} × {{ item.name }}
            <span class="text-muted">at {{ formatPrice(item.unitPriceCents) }}</span>
          </p>
        </template>
        <template #totalCents="{ row }">{{ formatPrice(row.totalCents) }}</template>
      </DataTable>
    </LoadState>
  </PageSection>
</template>
