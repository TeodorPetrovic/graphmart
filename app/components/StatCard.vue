<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  detail?: string
}>()
</script>

<template>
  <article class="rounded-xl border border-default bg-elevated/40 p-4">
    <p class="text-sm font-medium text-muted">{{ label }}</p>
    <p class="mt-2 text-3xl font-bold tabular-nums">{{ value }}</p>
    <p v-if="detail" class="mt-1 text-sm text-muted">{{ detail }}</p>
  </article>
</template>
