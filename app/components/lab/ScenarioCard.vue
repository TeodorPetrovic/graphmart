<script setup lang="ts">
import type { ScenarioInfo } from '#shared/types/api'

defineProps<{ scenario: ScenarioInfo }>()
</script>

<template>
  <UCard class="transition hover:border-primary hover:bg-elevated">
    <NuxtLink :to="`/lab/${scenario.id}`" class="block focus-visible:outline-2 focus-visible:outline-primary">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-lg font-semibold">{{ scenario.title }}</h3>
        <span class="text-sm text-muted">#{{ scenario.order }}</span>
      </div>
      <p class="mt-2 text-sm text-muted">{{ scenario.question }}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <EngineBadge v-for="engine in scenario.engines" :key="engine.engine" :engine="engine.engine" />
      </div>
    </NuxtLink>
  </UCard>
</template>
