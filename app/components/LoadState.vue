<script setup lang="ts">
import { apiErrorMessage } from '~/composables/useApiError'

/** Wraps fetched content: spinner while loading, readable message on failure. */
const props = defineProps<{
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: unknown
}>()
const message = computed(() => apiErrorMessage(props.error))
</script>

<template>
  <UAlert
    v-if="status === 'error'"
    color="error"
    variant="subtle"
    title="Could not load data"
    :description="`${message} — are the databases running (bun run db:up) and seeded (bun run seed)?`"
  />
  <div v-else-if="status === 'pending' || status === 'idle'" class="space-y-3" aria-busy="true">
    <USkeleton class="h-8 w-1/3" />
    <USkeleton class="h-40 w-full" />
  </div>
  <slot v-else />
</template>
