<script setup lang="ts">
import type { BenchmarkReportResponse, EngineId, ScenarioInfo, ScenarioListResponse } from '#shared/types/api'

const ENGINES: EngineId[] = ['mysql', 'mongo', 'neo4j']
const { data: list, status, error } = useFetch<ScenarioListResponse>('/api/lab/scenarios')
const { data: saved } = useFetch<BenchmarkReportResponse>('/api/lab/report')
const report = computed(() => saved.value?.report)
const lectures = computed(() =>
  ([1, 2] as const).map((lecture) => ({
    lecture,
    scenarios: (list.value?.scenarios ?? [])
      .filter((scenario) => scenario.lecture === lecture)
      .sort((a, b) => a.order - b.order),
  })),
)
const columns = [
  { key: 'title', label: 'Question' },
  ...ENGINES.map((engine) => ({ key: engine, label: ENGINE_NAMES[engine], align: 'right' as const })),
]

function medians(scenarioId: string) {
  const results = report.value?.results.find((item) => item.scenarioId === scenarioId)?.results ?? []
  return new Map(results.flatMap((r) => (r.ok && r.medianMs !== null ? [[r.engine, r.medianMs] as const] : [])))
}
/** One row per scenario: its title and the saved median time of each database. */
const rows = (scenarios: ScenarioInfo[]) =>
  scenarios.map((scenario) => {
    const times = medians(scenario.id)
    return {
      id: scenario.id,
      title: scenario.title,
      engines: scenario.engines.map((item) => item.engine),
      times,
      fastest: Math.min(...times.values()),
    }
  })
</script>

<template>
  <div class="space-y-8">
    <p v-if="report" class="text-sm text-muted">
      Median time in milliseconds from the last benchmark ({{ formatTimestamp(report.generatedAt) }},
      {{ report.scale }} dataset, {{ report.iterations }} runs, {{ report.machine }}). Bold is fastest.
    </p>
    <p v-else class="text-sm text-muted">No saved times yet. Run <code>bun run bench</code> to fill the table.</p>
    <LoadState :status="status" :error="error">
      <div class="space-y-8">
        <PageSection v-for="group in lectures" :key="group.lecture" :title="`Class ${group.lecture}`">
          <DataTable :rows="rows(group.scenarios)" :columns="columns" :row-key="(row) => row.id">
            <template #title="{ row }">
              <ULink :to="`/lab/${row.id}`" class="text-default underline">{{ row.title }}</ULink>
            </template>
            <template v-for="engine in ENGINES" :key="engine" #[engine]="{ row }">
              <span v-if="row.times.has(engine)" :class="row.times.get(engine) === row.fastest ? 'font-bold' : ''">
                {{ row.times.get(engine)?.toFixed(2) }}
              </span>
              <span v-else class="text-muted">{{ row.engines.includes(engine) ? 'not run' : '' }}</span>
            </template>
          </DataTable>
        </PageSection>
      </div>
    </LoadState>
  </div>
</template>
