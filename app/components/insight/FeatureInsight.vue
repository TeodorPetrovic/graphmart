<script setup lang="ts">
import type { QueryTrace } from '#shared/types/api'
import { INSIGHTS, type Insight, type InsightId } from '~/utils/insights'

/** Query time and a "How this works" panel, shown beside the feature they describe. */
const props = defineProps<{ feature: InsightId; trace?: QueryTrace[] }>()
const insight = computed<Insight>(() => INSIGHTS[props.feature])
const engineName = computed(() => (insight.value.engine === 'mongo' ? 'MongoDB' : 'Neo4j'))
const time = computed(() => {
  const entries = (props.trace ?? []).filter((entry) => entry.engine === insight.value.engine)
  return entries.length ? entries.reduce((sum, entry) => sum + entry.ms, 0) : null
})
</script>

<template>
  <div class="flex items-center gap-3 text-sm text-muted">
    <span v-if="time !== null" class="tabular-nums"> {{ engineName }} {{ time < 1 ? '<1' : time.toFixed(0) }} ms </span>
    <USlideover title="How this works" :description="insight.summary" :ui="{ content: 'max-w-2xl' }">
      <UButton color="neutral" variant="link" class="p-0 underline">How this works</UButton>
      <template #body>
        <div class="space-y-6 text-sm">
          <PageSection title="With MySQL tables" :note="insight.before" />
          <PageSection :title="`With ${engineName}`" :note="insight.now" />
          <UButton v-if="insight.scenarioId" :to="`/lab/${insight.scenarioId}`" color="neutral" variant="outline">
            Compare the two
          </UButton>
          <QueryTracePanel :trace="trace" />
        </div>
      </template>
    </USlideover>
  </div>
</template>
