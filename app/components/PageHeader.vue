<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description: string
  }>(),
  { eyebrow: '' },
)
</script>

<template>
  <header class="space-y-2">
    <p v-if="eyebrow" class="text-sm font-semibold uppercase tracking-widest text-primary">{{ eyebrow }}</p>
    <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">{{ title }}</h2>
    <p class="max-w-4xl text-lg leading-relaxed text-muted">{{ description }}</p>
  </header>
</template>
