<script setup lang="ts">
import type { RunScenarioResponse } from '#shared/types/api'

const props = defineProps<{ result: RunScenarioResponse }>()

const resultRows = computed(() =>
  props.result.results.flatMap((item) => (item.ok ? item.rows.map((row) => ({ engine: item.engine, row })) : [])),
)
const rowColumns = computed(() => [...new Set(resultRows.value.flatMap((entry) => Object.keys(entry.row)))])
const tableColumns = computed(() => [
  { accessorKey: 'engine', header: 'Engine' },
  ...rowColumns.value.map((column) => ({ accessorKey: column, header: column })),
])
const tableRows = computed(() => resultRows.value.map((entry) => ({ engine: entry.engine, ...entry.row })))
const medianTimes = computed(() =>
  props.result.results.flatMap((item) => (item.ok && item.medianMs !== null ? [item.medianMs] : [])),
)
const maxRatio = computed(() =>
  medianTimes.value.length ? Math.max(...medianTimes.value) / Math.min(...medianTimes.value) : 1,
)

function relativeWidth(medianMs: number) {
  const fastest = Math.min(...medianTimes.value)
  const ratio = medianMs / fastest
  return `${Math.max(5, (Math.log10(ratio + 1) / Math.log10(maxRatio.value + 1)) * 100)}%`
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-semibold">Results</h2>
      <UBadge v-if="result.resultsMatch === true" color="success">Results identical</UBadge>
      <UBadge v-else-if="result.resultsMatch === false" color="warning">Results differ</UBadge>
      <span v-else class="text-sm text-muted">Identity not compared (fewer than two engines succeeded)</span>
    </div>
    <UAlert
      v-if="result.resultsMatch === false"
      color="warning"
      variant="subtle"
      title="The databases hold different data"
      description="Orders, reviews and follows created in the app are written to MongoDB and Neo4j only; MySQL keeps the seeded snapshot. Run bun run seed to reset all three."
    />
    <p v-if="maxRatio > 10" class="text-sm text-muted">
      Relative bars use a logarithmic scale because the ratio exceeds 10×.
    </p>
    <div class="grid gap-3 md:grid-cols-3">
      <UCard v-for="item in result.results" :key="item.engine">
        <div class="flex items-center justify-between">
          <EngineBadge :engine="item.engine" />
          <UBadge v-if="item.ok" color="success">{{ item.rowCount }} rows</UBadge>
          <UBadge v-else color="error">{{ item.timedOut ? 'Timed out' : 'Failed' }}</UBadge>
        </div>
        <p v-if="item.error" class="text-sm text-error">{{ item.error }}</p>
        <dl v-if="item.ok" class="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt class="text-xs text-muted">Median</dt>
            <dd class="text-lg font-bold tabular-nums">{{ item.medianMs?.toFixed(2) }} ms</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Min</dt>
            <dd class="tabular-nums">{{ item.minMs?.toFixed(2) }} ms</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">P95</dt>
            <dd class="tabular-nums">{{ item.p95Ms?.toFixed(2) }} ms</dd>
          </div>
        </dl>
        <div v-if="item.ok && item.medianMs !== null" class="space-y-1">
          <p class="text-xs text-muted">Median time, relative</p>
          <div class="h-4 rounded bg-elevated" role="img" :aria-label="`${item.engine} median relative bar`">
            <div class="h-full rounded bg-primary" :style="{ width: relativeWidth(item.medianMs) }" />
          </div>
        </div>
      </UCard>
    </div>
    <UCard>
      <template #header><h3 class="text-lg font-semibold">Result rows (up to 50 per engine)</h3></template>
      <UTable :data="tableRows" :columns="tableColumns" />
      <UEmpty v-if="!resultRows.length" icon="i-lucide-list-x" title="No result rows available" />
    </UCard>
  </section>
</template>
