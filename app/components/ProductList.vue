<script setup lang="ts">
import type { ProductSummary } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'

/** Products as rows, each with the reason it is listed. */
defineProps<{ items: { product: ProductSummary; reasons: string[] }[]; empty: string }>()
</script>

<template>
  <ul v-if="items.length" class="divide-y divide-default border-y border-default">
    <li v-for="item in items" :key="item.product.id" class="flex items-start justify-between gap-4 py-2.5">
      <div class="min-w-0">
        <ULink :to="`/shop/${item.product.id}`" class="font-medium text-default hover:underline">
          {{ item.product.name }}
        </ULink>
        <p class="text-sm text-muted">{{ item.reasons.join('. ') }}</p>
      </div>
      <span class="shrink-0 text-sm tabular-nums">{{ formatPrice(item.product.priceCents) }}</span>
    </li>
  </ul>
  <p v-else class="text-sm text-muted">{{ empty }}</p>
</template>
