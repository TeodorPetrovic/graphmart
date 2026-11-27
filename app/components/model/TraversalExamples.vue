<script setup lang="ts">
import { BEFORE_AFTER } from '#shared/utils/before-after'

const selectedId = ref(BEFORE_AFTER[0]!.id)
const selected = computed(() => BEFORE_AFTER.find((example) => example.id === selectedId.value) ?? BEFORE_AFTER[0]!)
const choices = BEFORE_AFTER.map((example) => ({ label: example.title, value: example.id }))
</script>

<template>
  <PageSection title="Nested SQL queries and their Cypher versions">
    <USelect v-model="selectedId" :items="choices" aria-label="Example" class="w-full max-w-md" />
    <p>{{ selected.question }}</p>
    <div class="grid gap-4 xl:grid-cols-2">
      <div class="space-y-1">
        <h3 class="text-sm font-medium">MySQL</h3>
        <CodeBlock :code="selected.sql.trim()" />
      </div>
      <div class="space-y-1">
        <h3 class="text-sm font-medium">Neo4j</h3>
        <CodeBlock :code="selected.cypher.trim()" />
        <p class="text-sm text-muted">{{ selected.changes }}</p>
        <ULink :to="`/lab/${selected.scenarioId}`" class="text-sm underline">Compare their speed</ULink>
      </div>
    </div>
  </PageSection>
</template>
