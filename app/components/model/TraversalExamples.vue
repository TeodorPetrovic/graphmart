<script setup lang="ts">
import { BEFORE_AFTER } from '#shared/utils/before-after'

const selectedId = ref(BEFORE_AFTER[0]!.id)
const selected = computed(() => BEFORE_AFTER.find((example) => example.id === selectedId.value) ?? BEFORE_AFTER[0]!)
const exampleTabs = BEFORE_AFTER.map((example) => ({ label: example.title, value: example.id }))
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-2xl font-semibold">The inner queries the graph replaces</h2>
    <UTabs v-model="selectedId" :items="exampleTabs" :content="false" />
    <p class="text-lg">{{ selected.question }}</p>
    <div class="grid gap-4 xl:grid-cols-2">
      <article class="space-y-2">
        <h3 class="flex items-center gap-2 font-semibold"><EngineBadge engine="mysql" /> Before</h3>
        <pre class="overflow-auto rounded-lg bg-neutral-950 p-4 text-sm leading-relaxed text-neutral-100">{{
          selected.sql.trim()
        }}</pre>
      </article>
      <article class="space-y-2">
        <h3 class="flex items-center gap-2 font-semibold"><EngineBadge engine="neo4j" /> After</h3>
        <pre class="overflow-auto rounded-lg bg-neutral-950 p-4 text-sm leading-relaxed text-neutral-100">{{
          selected.cypher.trim()
        }}</pre>
        <p class="text-muted">{{ selected.changes }}</p>
        <UButton :to="`/lab/${selected.scenarioId}`" variant="soft">Measure it in the performance lab</UButton>
      </article>
    </div>
  </section>
</template>
