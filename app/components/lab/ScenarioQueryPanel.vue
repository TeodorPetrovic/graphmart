<script setup lang="ts">
import type { EngineId, ExplainResponse, ScenarioInfo } from '#shared/types/api'

const props = defineProps<{
  scenario: ScenarioInfo
  selectedEngine: EngineId
  explaining: EngineId | null
  explain: ExplainResponse | null
  errorMessage: string
}>()
const emit = defineEmits<{
  'update:selectedEngine': [engine: EngineId]
  explain: [engine: EngineId]
}>()

const engineInfo = computed(() => props.scenario.engines.find((item) => item.engine === props.selectedEngine))
const engineTabs = computed(() =>
  props.scenario.engines.map((item) => ({ label: item.engine.toUpperCase(), value: item.engine })),
)
function selectEngine(value: string | number) {
  const engine = props.scenario.engines.find((item) => item.engine === value)?.engine
  if (engine) emit('update:selectedEngine', engine)
}
</script>

<template>
  <UCard class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">Query text and explain plan</h2>
        <p class="text-sm text-muted">The scenario query is shown for each engine. Explain runs independently.</p>
      </div>
      <UTabs :model-value="selectedEngine" :items="engineTabs" :content="false" @update:model-value="selectEngine" />
    </div>
    <div v-if="engineInfo" class="space-y-3">
      <p class="text-sm text-muted">{{ engineInfo.label }} · {{ engineInfo.language }}</p>
      <pre class="max-h-96 overflow-auto rounded-lg bg-neutral-950 p-4 text-sm leading-relaxed text-neutral-100">{{
        engineInfo.query
      }}</pre>
      <ul class="list-inside list-disc text-sm text-muted">
        <li v-for="note in engineInfo.notes" :key="note">{{ note }}</li>
      </ul>
      <UButton :loading="explaining === selectedEngine" @click="emit('explain', selectedEngine)">
        Explain {{ selectedEngine }}
      </UButton>
    </div>
    <UAlert v-if="errorMessage" color="error" :description="errorMessage" />
    <section v-if="explain" class="rounded-lg bg-elevated p-4">
      <h3 class="font-semibold">{{ explain.engine }} explain metrics</h3>
      <dl class="mt-3 grid gap-2 sm:grid-cols-2">
        <div v-for="metric in explain.metrics" :key="metric.label" class="flex justify-between gap-4">
          <dt>{{ metric.label }}</dt>
          <dd class="font-mono">{{ metric.value }}</dd>
        </div>
      </dl>
      <pre class="mt-4 max-h-96 overflow-auto rounded-lg bg-neutral-950 p-4 text-sm text-neutral-100">{{
        explain.plan
      }}</pre>
    </section>
  </UCard>
</template>
