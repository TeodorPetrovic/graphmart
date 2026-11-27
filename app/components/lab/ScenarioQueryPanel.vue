<script setup lang="ts">
import type { EngineId, ExplainResponse, ScenarioInfo } from '#shared/types/api'

const engine = defineModel<EngineId>('engine', { required: true })
const props = defineProps<{
  scenario: ScenarioInfo
  explaining: boolean
  explain: ExplainResponse | null
  errorMessage: string
}>()
const emit = defineEmits<{ explain: [] }>()

const info = computed(() => props.scenario.engines.find((item) => item.engine === engine.value))
const tabs = computed(() =>
  props.scenario.engines.map((item) => ({ label: ENGINE_NAMES[item.engine], value: item.engine })),
)
</script>

<template>
  <PageSection title="Queries">
    <UTabs v-model="engine" :items="tabs" :content="false" variant="link" color="neutral" />
    <template v-if="info">
      <p class="text-sm text-muted">{{ info.label }}</p>
      <CodeBlock :code="info.query" />
      <ul v-if="info.notes.length" class="list-inside list-disc text-sm text-muted">
        <li v-for="note in info.notes" :key="note">{{ note }}</li>
      </ul>
      <UButton color="neutral" variant="outline" :loading="explaining" @click="emit('explain')">
        Show the query plan
      </UButton>
    </template>
    <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />
    <template v-if="explain">
      <dl class="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        <div v-for="metric in explain.metrics" :key="metric.label" class="flex justify-between gap-4">
          <dt class="text-muted">{{ metric.label }}</dt>
          <dd class="tabular-nums">{{ metric.value }}</dd>
        </div>
      </dl>
      <CodeBlock :code="explain.plan" />
    </template>
  </PageSection>
</template>
