<script setup lang="ts">
const props = defineProps<{ rows: { label: string; value: number; display: string }[] }>()
const largest = computed(() => Math.max(1, ...props.rows.map((row) => row.value)))
</script>

<template>
  <ul v-if="rows.length" class="space-y-1.5 text-sm">
    <li v-for="row in rows" :key="row.label" class="grid grid-cols-[9rem_1fr_8rem] items-center gap-3">
      <span class="truncate">{{ row.label }}</span>
      <span class="h-2 bg-elevated" aria-hidden="true">
        <span class="block h-full bg-inverted/70" :style="{ width: `${(row.value / largest) * 100}%` }" />
      </span>
      <span class="text-right tabular-nums">{{ row.display }}</span>
    </li>
  </ul>
  <p v-else class="text-sm text-muted">Nothing to show.</p>
</template>
