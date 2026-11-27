<script setup lang="ts">
import type { QueryTrace } from '#shared/types/api'

const props = defineProps<{ trace: QueryTrace[] | undefined }>()
const open = ref<number | null>(null)
const total = computed(() => (props.trace ?? []).reduce((sum, entry) => sum + entry.ms, 0))
</script>

<template>
  <UCard v-if="trace?.length">
    <template #header
      ><div class="flex items-center justify-between gap-3">
        <span class="font-semibold">Queries behind this screen</span
        ><UBadge color="neutral" variant="subtle">{{ trace.length }} · {{ total.toFixed(1) }} ms</UBadge>
      </div></template
    >
    <ul class="divide-y divide-default">
      <li v-for="(entry, index) in trace" :key="index">
        <button
          type="button"
          class="flex w-full items-center gap-3 py-3 text-left text-sm hover:bg-elevated"
          :aria-expanded="open === index"
          @click="open = open === index ? null : index"
        >
          <EngineBadge :engine="entry.engine" />
          <span class="grow truncate">{{ entry.operation }}</span>
          <UBadge color="neutral" variant="subtle">{{ entry.ms.toFixed(2) }} ms</UBadge>
        </button>
        <pre
          v-if="open === index"
          class="max-h-96 overflow-auto rounded-lg bg-neutral-950 p-4 text-sm leading-relaxed text-neutral-100"
          >{{ entry.query }}</pre>
      </li>
    </ul>
  </UCard>
</template>
