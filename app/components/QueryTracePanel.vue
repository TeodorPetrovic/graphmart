<script setup lang="ts">
import type { QueryTrace } from '#shared/types/api'

const props = defineProps<{ trace: QueryTrace[] | undefined }>()
const total = computed(() => (props.trace ?? []).reduce((sum, entry) => sum + entry.ms, 0))
</script>

<template>
  <PageSection v-if="trace?.length" title="Queries behind this screen">
    <template #aside>
      <span class="text-sm text-muted tabular-nums">{{ trace.length }} queries, {{ total.toFixed(1) }} ms</span>
    </template>
    <ul class="divide-y divide-default border-y border-default text-sm">
      <li v-for="(entry, index) in trace" :key="index">
        <details>
          <summary class="flex cursor-pointer items-center gap-3 py-2">
            <EngineBadge :engine="entry.engine" />
            <span class="grow">{{ entry.operation }}</span>
            <span class="text-muted tabular-nums">{{ entry.ms.toFixed(2) }} ms</span>
          </summary>
          <CodeBlock class="mb-2" :code="entry.query" />
        </details>
      </li>
    </ul>
  </PageSection>
</template>
