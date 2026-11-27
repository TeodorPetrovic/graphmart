<script setup lang="ts">
import type {
  EngineId,
  ExplainResponse,
  ScenarioInfo,
  ScenarioListResponse,
  RunScenarioResponse,
} from '#shared/types/api'

const route = useRoute()
const scenarioId = computed(() => String(route.params.id))
// Awaited so the form is initialised from the scenario during setup, on the server and the client alike.
const { data: scenario, status, error } = await useFetch<ScenarioInfo>(() => `/api/lab/scenarios/${scenarioId.value}`)
const { data: scenarioList } = useFetch<ScenarioListResponse>('/api/lab/scenarios')
const params = reactive<Record<string, number | string>>({})
const iterations = ref(5)
const selectedEngines = ref<EngineId[]>([])
const running = ref(false)
const runError = ref('')
const result = ref<RunScenarioResponse | null>(null)
const selectedQueryEngine = ref<EngineId>('mysql')
const explain = ref<ExplainResponse | null>(null)
const explaining = ref<EngineId | null>(null)
const explainError = ref('')
const availableScenarios = computed(() =>
  [...(scenarioList.value?.scenarios ?? [])].sort((a, b) => a.lecture - b.lecture || a.order - b.order),
)
const currentIndex = computed(() => availableScenarios.value.findIndex((item) => item.id === scenarioId.value))
const previousScenario = computed(() => availableScenarios.value[currentIndex.value - 1])
const nextScenario = computed(() => availableScenarios.value[currentIndex.value + 1])

watch(
  scenario,
  (value) => {
    if (!value) return
    for (const key of Object.keys(params)) delete params[key]
    for (const item of value.params) params[item.name] = item.default
    selectedEngines.value = value.engines.map((item) => item.engine)
    selectedQueryEngine.value = value.engines[0]?.engine ?? 'mysql'
    result.value = null
    explain.value = null
  },
  { immediate: true },
)

function setParam(name: string, rawValue: string) {
  const spec = scenario.value?.params.find((item) => item.name === name)
  params[name] = spec?.type === 'number' ? Number(rawValue) : rawValue
}
function toggleEngine(engine: EngineId) {
  selectedEngines.value = selectedEngines.value.includes(engine)
    ? selectedEngines.value.filter((item) => item !== engine)
    : [...selectedEngines.value, engine]
}
async function runScenario() {
  running.value = true
  runError.value = ''
  result.value = null
  try {
    result.value = await $fetch<RunScenarioResponse>(`/api/lab/scenarios/${scenarioId.value}/run`, {
      method: 'POST',
      body: { params: { ...params }, iterations: iterations.value, engines: selectedEngines.value },
    })
  } catch (cause) {
    runError.value = apiErrorMessage(cause, 'The scenario could not be run.')
  } finally {
    running.value = false
  }
}
async function explainEngine(engine: EngineId) {
  explaining.value = engine
  explainError.value = ''
  try {
    explain.value = await $fetch<ExplainResponse>(`/api/lab/scenarios/${scenarioId.value}/explain`, {
      method: 'POST',
      body: { engine, params: { ...params } },
    })
  } catch (cause) {
    explainError.value = apiErrorMessage(cause, 'Could not explain this query.')
  } finally {
    explaining.value = null
  }
}
</script>

<template>
  <main class="space-y-6 p-6 lg:p-8">
    <header>
      <NuxtLink to="/lab" class="text-sm font-semibold text-primary hover:underline">← All scenarios</NuxtLink>
      <h1 class="mt-2 text-3xl font-bold">{{ scenario?.title ?? 'Lab scenario' }}</h1>
      <p class="mt-1 text-lg text-muted">{{ scenario?.question }}</p>
    </header>
    <LoadState :status="status" :error="error">
      <template v-if="scenario">
        <section class="grid gap-4 md:grid-cols-2">
          <article class="rounded-xl border border-default p-5">
            <h2 class="text-xl font-semibold">Why it hurts in tables</h2>
            <p class="mt-2 leading-relaxed">{{ scenario.relationalPain }}</p>
          </article>
          <article class="rounded-xl border border-default p-5">
            <h2 class="text-xl font-semibold">Why this model helps</h2>
            <p class="mt-2 leading-relaxed">{{ scenario.nosqlWin }}</p>
          </article>
        </section>
        <section class="rounded-xl border border-default p-5">
          <h2 class="text-xl font-semibold">Talking points</h2>
          <ul class="mt-3 list-inside list-disc space-y-2">
            <li v-for="point in scenario.talkingPoints" :key="point">{{ point }}</li>
          </ul>
        </section>
        <section class="space-y-4 rounded-xl border border-default p-5">
          <h2 class="text-xl font-semibold">Run this question</h2>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <UFormField v-for="param in scenario.params" :key="param.name" :label="param.label"
              ><UInput
                :model-value="String(params[param.name] ?? param.default)"
                :type="param.type === 'number' ? 'number' : 'text'"
                :min="param.min"
                :max="param.max"
                @update:model-value="setParam(param.name, $event)" /></UFormField
            ><UFormField label="Iterations"
              ><UInput v-model.number="iterations" type="number" min="1" max="30"
            /></UFormField>
          </div>
          <div>
            <p class="mb-2 font-semibold">Compare engines</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="{ engine } in scenario.engines"
                :key="engine"
                color="neutral"
                :variant="selectedEngines.includes(engine) ? 'soft' : 'ghost'"
                :class="selectedEngines.includes(engine) ? 'ring-2 ring-primary' : 'opacity-50'"
                :aria-pressed="selectedEngines.includes(engine)"
                @click="toggleEngine(engine)"
                ><EngineBadge :engine="engine"
              /></UButton>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <UButton :loading="running" :disabled="running || selectedEngines.length === 0" @click="runScenario">{{
              running ? 'Running…' : 'Run scenario'
            }}</UButton><span v-if="running" class="text-sm text-muted" role="status"
              >Queries are running. Long database queries may time out.</span
            >
          </div>
          <UAlert v-if="runError" color="error" title="Run failed" :description="runError" />
        </section>
        <LabScenarioResults v-if="result" :result="result" />
        <LabScenarioQueryPanel
          :scenario="scenario"
          :selected-engine="selectedQueryEngine"
          :explaining="explaining"
          :explain="explain"
          :error-message="explainError"
          @update:selected-engine="selectedQueryEngine = $event"
          @explain="explainEngine"
        />
        <nav class="flex justify-between border-t border-default pt-4" aria-label="Scenario navigation">
          <NuxtLink
            v-if="previousScenario"
            :to="`/lab/${previousScenario.id}`"
            class="font-semibold text-primary hover:underline"
            >← {{ previousScenario.title }}</NuxtLink
          ><span v-else /><NuxtLink
            v-if="nextScenario"
            :to="`/lab/${nextScenario.id}`"
            class="font-semibold text-primary hover:underline"
            >{{ nextScenario.title }} →</NuxtLink
          >
        </nav>
      </template>
    </LoadState>
  </main>
</template>
