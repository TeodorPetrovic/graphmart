<script setup lang="ts">
import { apiErrorMessage } from '~/composables/useApiError'

/** Wraps fetched content: placeholder while loading, readable message on failure. */
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
    :description="`${message} Check that MongoDB, Neo4j and MySQL are running and that .env points to them.`"
  />
  <div v-else-if="status === 'pending' || status === 'idle'" class="space-y-2" aria-busy="true">
    <USkeleton class="h-5 w-1/3" />
    <USkeleton class="h-32 w-full" />
  </div>
  <slot v-else />
</template>
