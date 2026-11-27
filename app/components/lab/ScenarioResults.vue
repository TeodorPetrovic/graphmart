<script setup lang="ts">
import type { RunScenarioResponse } from '#shared/types/api'

const props = defineProps<{ result: RunScenarioResponse }>()

const rows = computed(() =>
  props.result.results.flatMap((item) =>
    item.ok ? item.rows.map((row) => ({ ...row, engine: ENGINE_NAMES[item.engine] })) : [],
  ),
)
const rowColumns = computed(() =>
  [...new Set(['engine', ...rows.value.flatMap((row) => Object.keys(row))])].map((key) => ({
    key,
    label: key === 'engine' ? 'Database' : key,
  })),
)
const milliseconds = (value: number | null) => (value === null ? '' : value.toFixed(2))
</script>

<template>
  <PageSection title="Times in milliseconds">
    <template #aside>
      <span v-if="result.resultsMatch === true" class="text-sm">All databases returned the same rows.</span>
    </template>
    <UAlert
      v-if="result.resultsMatch === false"
      color="warning"
      variant="subtle"
      title="The databases returned different rows"
      description="Orders, reviews and follows made in the app reach MongoDB and Neo4j only. Run bun run seed --replace to reset all three."
    />
    <DataTable
      :rows="result.results"
      :columns="[
        { key: 'engine', label: 'Database' },
        { key: 'medianMs', label: 'Median', align: 'right' },
        { key: 'minMs', label: 'Fastest run', align: 'right' },
        { key: 'p95Ms', label: '95th percentile', align: 'right' },
        { key: 'rowCount', label: 'Rows', align: 'right' },
      ]"
      :row-key="(item) => item.engine"
    >
      <template #engine="{ row }">
        {{ ENGINE_NAMES[row.engine] }}
        <p v-if="!row.ok" class="text-error">{{ row.timedOut ? 'Timed out.' : '' }} {{ row.error }}</p>
      </template>
      <template #medianMs="{ row }">
        <span class="font-semibold">{{ milliseconds(row.medianMs) }}</span>
      </template>
      <template #minMs="{ row }">{{ milliseconds(row.minMs) }}</template>
      <template #p95Ms="{ row }">{{ milliseconds(row.p95Ms) }}</template>
    </DataTable>
    <details class="text-sm">
      <summary class="cursor-pointer underline">Returned rows (up to 50 per database)</summary>
      <DataTable class="mt-2" :rows="rows" :columns="rowColumns" empty="No rows returned." />
    </details>
  </PageSection>
</template>
