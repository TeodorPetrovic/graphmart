<script setup lang="ts">
import type { QueryTrace } from '#shared/types/api'
import { INSIGHTS, type Insight, type InsightId } from '~/utils/insights'

/** Sits next to a feature: the benefit in one line, the explanation and real queries on demand. */
const props = defineProps<{ feature: InsightId; trace?: QueryTrace[] }>()
const insight = computed<Insight>(() => INSIGHTS[props.feature])
const engineName = computed(() => (insight.value.engine === 'mongo' ? 'MongoDB' : 'Neo4j'))
const time = computed(() => {
  const entries = (props.trace ?? []).filter((entry) => entry.engine === insight.value.engine)
  return entries.length ? entries.reduce((sum, entry) => sum + entry.ms, 0) : null
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated/50 px-4 py-3">
    <UIcon name="i-lucide-sparkles" class="size-5 shrink-0 text-primary" />
    <p class="min-w-48 grow text-sm">{{ insight.benefit }}</p>
    <UBadge v-if="time !== null" color="neutral" variant="subtle" icon="i-lucide-timer">
      {{ engineName }} {{ time < 1 ? '<1' : time.toFixed(0) }} ms
    </UBadge>
    <USlideover title="How this works" :description="insight.benefit" :ui="{ content: 'max-w-2xl' }">
      <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-lightbulb">How this works</UButton>
      <template #body>
        <div class="space-y-5">
          <UAlert
            color="neutral"
            variant="subtle"
            icon="i-lucide-table"
            title="Before, with tables"
            :description="insight.before"
          />
          <UAlert
            color="primary"
            variant="subtle"
            icon="i-lucide-zap"
            :title="`Now, with ${engineName}`"
            :description="insight.now"
          />
          <QueryTracePanel :trace="trace" />
          <UButton v-if="insight.scenarioId" :to="`/lab/${insight.scenarioId}`" icon="i-lucide-gauge" variant="soft">
            Compare with the old queries
          </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
