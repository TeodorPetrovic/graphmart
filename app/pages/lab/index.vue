<script setup lang="ts">
import type { BenchmarkReportResponse, ScenarioListResponse } from '#shared/types/api'

const { data: list, status, error } = useFetch<ScenarioListResponse>('/api/lab/scenarios')
const {
  data: reportData,
  status: reportStatus,
  error: reportError,
} = useFetch<BenchmarkReportResponse>('/api/lab/report')
const scenarios = computed(() => list.value?.scenarios ?? [])
const lectureOne = computed(() =>
  scenarios.value.filter((scenario) => scenario.lecture === 1).sort((a, b) => a.order - b.order),
)
const lectureTwo = computed(() =>
  scenarios.value.filter((scenario) => scenario.lecture === 2).sort((a, b) => a.order - b.order),
)
const reportResults = computed(() => reportData.value?.report?.results ?? [])
const maxRatio = computed(() =>
  Math.max(
    1,
    ...reportResults.value.flatMap((scenario) => {
      const times = scenario.results
        .filter((result) => result.ok && result.medianMs !== null)
        .flatMap((result) => (result.medianMs === null ? [] : [result.medianMs]))
      const fastest = Math.min(...times)
      return times.map((time) => time / fastest)
    }),
  ),
)
function barWidth(time: number, fastest: number) {
  return `${Math.max(4, (Math.log10(time / fastest + 1) / Math.log10(maxRatio.value + 1)) * 100)}%`
}
</script>

<template>
  <main class="space-y-8 p-6 lg:p-8">
    <PageHeader
      title="Performance lab"
      description="Run the same questions against relational, document, and graph approaches."
    />
    <section class="space-y-4">
      <div>
        <h2 class="text-2xl font-semibold">Latest benchmark</h2>
        <p class="text-sm text-muted">
          Stored run summary. Ratios are shown relative to the fastest successful engine per scenario.
        </p>
      </div>
      <LoadState :status="reportStatus" :error="reportError"
        ><div v-if="reportData?.report" class="space-y-4 rounded-xl border border-default p-4">
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <span>{{ formatTimestamp(reportData.report.generatedAt) }}</span><span
              >Scale: {{ reportData.report.scale }}</span
            ><span>{{ reportData.report.iterations }} iterations</span><span>{{ reportData.report.machine }}</span>
          </div>
          <p v-if="maxRatio > 10" class="text-sm font-medium">
            Relative time bars use a logarithmic scale because the largest ratio exceeds 10×.
          </p>
          <div
            v-for="scenario in reportResults"
            :key="scenario.scenarioId"
            class="space-y-2 border-t border-default pt-3"
          >
            <NuxtLink class="font-semibold text-primary hover:underline" :to="`/lab/${scenario.scenarioId}`">{{
              scenarios.find((item) => item.id === scenario.scenarioId)?.title ?? scenario.scenarioId
            }}</NuxtLink>
            <div
              v-for="result in scenario.results"
              :key="result.engine"
              class="grid grid-cols-[74px_1fr_100px] items-center gap-3 text-sm"
            >
              <EngineBadge :engine="result.engine" />
              <div
                class="h-4 rounded bg-elevated"
                role="img"
                :aria-label="`${result.engine}: ${result.medianMs?.toFixed(2) ?? 'unavailable'} milliseconds median`"
              >
                <div
                  class="h-full rounded bg-primary"
                  :style="{
                    width:
                      result.ok && result.medianMs !== null
                        ? barWidth(
                            result.medianMs,
                            Math.min(
                              ...scenario.results
                                .filter((r) => r.ok && r.medianMs !== null)
                                .flatMap((r) => (r.medianMs === null ? [] : [r.medianMs])),
                            ),
                          )
                        : '0%',
                  }"
                />
              </div>
              <span class="text-right tabular-nums">{{ result.medianMs?.toFixed(2) ?? '—' }} ms</span>
            </div>
          </div>
        </div>
        <UAlert
          v-else
          title="No saved benchmark report yet"
          description="Run benchmarks to publish a report summary here, or run a scenario live below."
          color="neutral"
      /></LoadState>
    </section>
    <LoadState :status="status" :error="error">
      <section class="space-y-3">
        <h2 class="text-2xl font-semibold">Lecture 1 · Documents</h2>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <LabScenarioCard v-for="scenario in lectureOne" :key="scenario.id" :scenario="scenario" />
        </div>
      </section>
      <section class="space-y-3">
        <h2 class="text-2xl font-semibold">Lecture 2 · Relationships</h2>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <LabScenarioCard v-for="scenario in lectureTwo" :key="scenario.id" :scenario="scenario" />
        </div>
      </section>
    </LoadState>
  </main>
</template>
