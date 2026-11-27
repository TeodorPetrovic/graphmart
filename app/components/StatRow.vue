<script setup lang="ts">
defineProps<{ stats: { label: string; value: string | number }[] }>()
</script>

<template>
  <dl class="flex flex-wrap gap-x-10 gap-y-3 border-y border-default py-3">
    <div v-for="stat in stats" :key="stat.label">
      <dt class="text-sm text-muted">{{ stat.label }}</dt>
      <dd class="text-xl font-semibold tabular-nums">{{ stat.value }}</dd>
    </div>
  </dl>
</template>
