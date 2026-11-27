<script setup lang="ts">
/** A titled block of a page. The `aside` slot sits at the end of the title row. */
defineProps<{ title: string; note?: string }>()
</script>

<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 class="text-base font-semibold">{{ title }}</h2>
      <slot name="aside" />
    </div>
    <p v-if="note" class="max-w-prose text-sm text-muted">{{ note }}</p>
    <slot />
  </section>
</template>
