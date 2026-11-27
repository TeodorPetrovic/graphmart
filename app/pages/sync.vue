<script setup lang="ts">
import type { RebuildResponse, ReconcileResponse, SyncStatusResponse } from '#shared/types/api'

const { data, status, error, refresh } = useFetch<SyncStatusResponse>('/api/sync/status')
const loadError = useLoadError(error)
let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => (refreshTimer = setInterval(() => void refresh(), 3000)))
onBeforeUnmount(() => clearInterval(refreshTimer))

const working = ref(false)
const message = ref('')
const details = ref<string[]>([])
const actionError = ref('')
async function maintain(work: () => Promise<{ message: string; details: string[] }>) {
  working.value = true
  actionError.value = ''
  message.value = ''
  details.value = []
  try {
    const outcome = await work()
    message.value = outcome.message
    details.value = outcome.details
    await refresh()
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'The action failed.')
  } finally {
    working.value = false
  }
}
const compareCounts = () =>
  maintain(async () => {
    const { checks } = await $fetch<ReconcileResponse>('/api/sync/reconcile', { method: 'POST' })
    return {
      message: checks.every((check) => check.inSync) ? 'The counts match.' : 'Some counts differ.',
      details: checks.map(
        (check) =>
          `${check.name}: MongoDB ${check.mongoCount}, Neo4j ${check.neo4jCount}${check.inSync ? '' : ' (differs)'}`,
      ),
    }
  })
function rebuild() {
  if (!window.confirm('Delete and recreate the data Neo4j copies from MongoDB? This can take a few minutes.')) return
  return maintain(async () => {
    const result = await $fetch<RebuildResponse>('/api/sync/rebuild', { method: 'POST' })
    return {
      message: `Rebuilt in ${(result.ms / 1000).toFixed(1)} s.`,
      details: Object.entries(result.rebuilt).map(([name, count]) => `${name}: ${formatCount(count)}`),
    }
  })
}

const stats = computed(() => {
  if (!data.value) return []
  const { projector, counts } = data.value
  return [
    { label: 'Copier', value: projector.running ? 'Running' : 'Stopped' },
    { label: 'Delivery', value: projector.mode === 'change-stream' ? 'Change stream' : 'Checked every second' },
    { label: 'Waiting', value: formatCount(counts.pending) },
    { label: 'Copied', value: formatCount(counts.processed) },
    { label: 'Failed', value: formatCount(counts.failed) },
  ]
})
const delay = (ms: number | null) => (ms === null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)
</script>

<template>
  <LoadState :status="data ? 'success' : status" :error="loadError">
    <div v-if="data" class="space-y-8">
      <PageSection
        title="MongoDB to Neo4j"
        note="Each change is saved in MongoDB with an outbox event. The app reads the event and updates Neo4j."
      >
        <StatRow :stats="stats" />
        <UAlert
          v-if="data.projector.mode === 'polling'"
          color="neutral"
          variant="subtle"
          title="MongoDB is running as a single server"
          description="Transactions and change streams need a replica set. Until then the app saves in steps and checks the outbox every second. The README explains how to switch."
        />
        <UAlert
          v-if="data.projector.lastError"
          color="error"
          variant="subtle"
          :description="data.projector.lastError"
        />
      </PageSection>

      <PageSection title="Maintenance">
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="outline" :disabled="working" @click="compareCounts">Compare counts</UButton>
          <UButton color="neutral" variant="outline" :loading="working" @click="rebuild">Rebuild Neo4j copy</UButton>
        </div>
        <p v-if="message" role="status" class="text-sm">{{ message }}</p>
        <ul v-if="details.length" class="text-sm text-muted tabular-nums">
          <li v-for="detail in details" :key="detail">{{ detail }}</li>
        </ul>
        <UAlert v-if="actionError" color="error" variant="subtle" :description="actionError" />
      </PageSection>

      <PageSection title="Recent events" note="Updates every 3 seconds.">
        <DataTable
          :rows="data.recent"
          :columns="[
            { key: 'type', label: 'Event' },
            { key: 'createdAt', label: 'Created' },
            { key: 'state', label: 'State' },
            { key: 'attempts', label: 'Failed tries', align: 'right' },
            { key: 'lagMs', label: 'Delay', align: 'right' },
          ]"
          :row-key="(event) => event.id"
          empty="No events yet. Place an order or write a review."
        >
          <template #createdAt="{ row }">{{ formatTimestamp(row.createdAt) }}</template>
          <template #state="{ row }">
            <span :class="row.error ? 'text-error' : ''">
              {{ row.error ? row.error : row.processedAt ? 'Copied' : 'Waiting' }}
            </span>
          </template>
          <template #lagMs="{ row }">{{ delay(row.lagMs) }}</template>
        </DataTable>
      </PageSection>
      <QueryTracePanel :trace="data.trace" />
    </div>
  </LoadState>
</template>
