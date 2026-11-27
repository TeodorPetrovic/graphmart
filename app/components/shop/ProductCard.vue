<script setup lang="ts">
import type { ProductSummary } from '#shared/types/api'
import { formatPrice } from '#shared/utils/demo'

defineProps<{ product: ProductSummary }>()
const emit = defineEmits<{ add: [product: ProductSummary] }>()
</script>

<template>
  <article class="flex flex-col rounded-xl border border-default bg-elevated/25 p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ product.brand }}</p>
        <NuxtLink :to="`/shop/${product.id}`" class="mt-1 block text-lg font-bold hover:text-primary">
          {{ product.name }}
        </NuxtLink>
      </div>
      <span class="rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
        {{ product.stock }} in stock
      </span>
    </div>
    <div class="mt-5 flex items-end justify-between">
      <div>
        <p class="text-2xl font-bold">{{ formatPrice(product.priceCents) }}</p>
        <p class="text-sm text-muted">★ {{ product.rating.toFixed(1) }} · {{ product.ratingCount }} reviews</p>
      </div>
      <UButton size="sm" :aria-label="`Add ${product.name} to cart`" @click="emit('add', product)">Add</UButton>
    </div>
  </article>
</template>
