<script setup lang="ts">
import type {
  EngineId,
  ExplainResponse,
  RunScenarioResponse,
  ScenarioInfo,
  ScenarioListResponse,
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
const explaining = ref(false)
const explainError = ref('')

const ordered = computed(() =>
  [...(scenarioList.value?.scenarios ?? [])].sort((a, b) => a.lecture - b.lecture || a.order - b.order),
)
const currentIndex = computed(() => ordered.value.findIndex((item) => item.id === scenarioId.value))
const previous = computed(() => ordered.value[currentIndex.value - 1])
const next = computed(() => ordered.value[currentIndex.value + 1])
const otherEngines = computed(() =>
  (scenario.value?.engines ?? [])
    .filter((item) => item.engine !== 'mysql')
    .map((item) => ENGINE_NAMES[item.engine])
    .join(' and '),
)

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
watch(selectedQueryEngine, () => (explain.value = null))

function setParam(name: string, rawValue: string | number) {
  const spec = scenario.value?.params.find((item) => item.name === name)
  params[name] = spec?.type === 'number' ? Number(rawValue) : String(rawValue)
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
    runError.value = apiErrorMessage(cause, 'The comparison could not be run.')
  } finally {
    running.value = false
  }
}
async function explainQuery() {
  explaining.value = true
  explainError.value = ''
  try {
    explain.value = await $fetch<ExplainResponse>(`/api/lab/scenarios/${scenarioId.value}/explain`, {
      method: 'POST',
      body: { engine: selectedQueryEngine.value, params: { ...params } },
    })
  } catch (cause) {
    explainError.value = apiErrorMessage(cause, 'Could not get the query plan.')
  } finally {
    explaining.value = false
  }
}
</script>

<template>
  <LoadState :status="status" :error="error">
    <div v-if="scenario" class="space-y-8">
      <div class="space-y-1">
        <ULink to="/lab" class="text-sm underline">All comparisons</ULink>
        <h2 class="text-2xl font-semibold">{{ scenario.title }}</h2>
        <p>{{ scenario.question }}</p>
      </div>
      <div class="grid gap-6 md:grid-cols-2">
        <PageSection title="With MySQL tables" :note="scenario.relationalPain" />
        <PageSection :title="`With ${otherEngines || 'an index'}`" :note="scenario.nosqlWin" />
      </div>
      <PageSection title="Points to make">
        <ul class="list-inside list-disc space-y-1 text-sm">
          <li v-for="point in scenario.talkingPoints" :key="point">{{ point }}</li>
        </ul>
      </PageSection>

      <PageSection title="Run it">
        <form class="space-y-3" @submit.prevent="runScenario">
          <div class="flex flex-wrap gap-3">
            <UFormField v-for="param in scenario.params" :key="param.name" :label="param.label">
              <UInput
                :model-value="String(params[param.name] ?? param.default)"
                :type="param.type === 'number' ? 'number' : 'text'"
                :min="param.min"
                :max="param.max"
                @update:model-value="setParam(param.name, $event)"
              />
            </UFormField>
            <UFormField label="Runs">
              <UInput v-model.number="iterations" type="number" min="1" max="30" class="w-20" />
            </UFormField>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <UCheckbox
              v-for="{ engine } in scenario.engines"
              :key="engine"
              :model-value="selectedEngines.includes(engine)"
              :label="ENGINE_NAMES[engine]"
              @update:model-value="toggleEngine(engine)"
            />
            <UButton type="submit" :loading="running" :disabled="running || !selectedEngines.length">Run</UButton>
          </div>
        </form>
        <UAlert v-if="runError" color="error" variant="subtle" :description="runError" />
      </PageSection>
      <LabScenarioResults v-if="result" :result="result" />
      <LabScenarioQueryPanel
        v-model:engine="selectedQueryEngine"
        :scenario="scenario"
        :explaining="explaining"
        :explain="explain"
        :error-message="explainError"
        @explain="explainQuery"
      />
      <nav class="flex justify-between gap-4 border-t border-default pt-3 text-sm" aria-label="Other comparisons">
        <ULink v-if="previous" :to="`/lab/${previous.id}`" class="underline">Previous: {{ previous.title }}</ULink>
        <span v-else />
        <ULink v-if="next" :to="`/lab/${next.id}`" class="underline">Next: {{ next.title }}</ULink>
      </nav>
    </div>
  </LoadState>
</template>
