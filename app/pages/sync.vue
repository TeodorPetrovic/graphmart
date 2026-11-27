<script setup lang="ts">
import type { RebuildResponse, ReconcileResponse, SyncStatusResponse } from '#shared/types/api'
const { data, status, error, refresh } = useFetch<SyncStatusResponse>('/api/sync/status')
const loadError = useLoadError(error)
let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refreshTimer = setInterval(() => void refresh(), 3000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
const action = ref('')
const actionError = ref('')
const working = ref(false)
const actionDetails = ref<string[]>([])
async function reconcile() {
  if (!window.confirm('Compare MongoDB source counts with Neo4j projection counts?')) return
  working.value = true
  actionError.value = ''
  action.value = ''
  actionDetails.value = []
  try {
    const result = await $fetch<ReconcileResponse>('/api/sync/reconcile', { method: 'POST' })
    action.value = result.checks.every((check) => check.inSync)
      ? 'All projection counts are in sync.'
      : 'Reconcile finished. Review the count differences below.'
    actionDetails.value = result.checks.map(
      (check) =>
        `${check.name}: MongoDB ${check.mongoCount}, Neo4j ${check.neo4jCount} · ${check.inSync ? 'in sync' : 'different'}`,
    )
    await refresh()
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Reconcile failed.')
  } finally {
    working.value = false
  }
}
async function rebuild() {
  if (!window.confirm('Rebuild MongoDB-owned nodes and relationships in Neo4j? This can take a little while.')) return
  working.value = true
  actionError.value = ''
  action.value = ''
  actionDetails.value = []
  try {
    const result = await $fetch<RebuildResponse>('/api/sync/rebuild', { method: 'POST' })
    action.value = `Rebuild completed in ${result.ms.toFixed(0)} ms.`
    actionDetails.value = Object.entries(result.rebuilt).map(([name, count]) => `${name}: ${formatCount(count)}`)
    await refresh()
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Rebuild failed.')
  } finally {
    working.value = false
  }
}
const lagLabel = (lag: number | null) =>
  lag === null ? 'Pending' : lag < 1000 ? `${lag} ms` : `${(lag / 1000).toFixed(1)} s`
const eventRows = computed(() =>
  (data.value?.recent ?? []).map((event) => ({
    id: event.id,
    type: event.type,
    created: formatTimestamp(event.createdAt),
    lag: lagLabel(event.lagMs),
    state: event.error ? 'Failed' : event.processedAt ? 'Processed' : 'Pending',
    attempts: `${event.attempts} tries`,
  })),
)
const eventColumns = [
  { accessorKey: 'id', header: 'Event' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'created', header: 'Created' },
  { accessorKey: 'lag', header: 'Delivery lag' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'attempts', header: 'Attempts' },
]
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      eyebrow="Presentation / Replication"
      title="Sync monitor"
      description="MongoDB outbox events stream into Neo4j, keeping the graph projection close to the transaction source."
    />
    <LoadState :status="status" :error="loadError"
      ><template v-if="data"
        ><section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard>
            <p class="text-sm text-muted">Projector</p>
            <p class="mt-2 text-xl font-bold" :class="data.projector.running ? 'text-success' : 'text-warning'">
              {{ data.projector.running ? 'Running' : 'Stopped' }}
            </p>
            <p class="mt-1 text-xs text-muted">
              Started {{ data.projector.startedAt ? formatTimestamp(data.projector.startedAt) : '—' }}
            </p>
          </UCard>
          <UCard>
            <p class="text-sm text-muted">Pending events</p>
            <p class="mt-2 text-3xl font-bold tabular-nums">{{ data.counts.pending }}</p>
          </UCard>
          <UCard>
            <p class="text-sm text-muted">Processed</p>
            <p class="mt-2 text-3xl font-bold tabular-nums text-success">
              {{ formatCount(data.counts.processed) }}
            </p>
          </UCard>
          <UCard>
            <p class="text-sm text-muted">Failed</p>
            <p class="mt-2 text-3xl font-bold tabular-nums" :class="data.counts.failed ? 'text-error' : ''">
              {{ formatCount(data.counts.failed) }}
            </p>
          </UCard>
        </section>
        <section
          class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default bg-elevated/30 p-5"
        >
          <div>
            <h2 class="text-xl font-bold">Projection maintenance</h2>
            <p class="text-sm text-muted">Reconcile compares counts; rebuild replays MongoDB-owned facts into Neo4j.</p>
            <p v-if="data.projector.lastError" class="mt-2 text-sm text-error">{{ data.projector.lastError }}</p>
            <p v-if="action" role="status" class="mt-2 text-sm text-success">{{ action }}</p>
            <ul v-if="actionDetails.length" class="mt-2 space-y-1 text-sm text-muted">
              <li v-for="detail in actionDetails" :key="detail">{{ detail }}</li>
            </ul>
            <p v-if="actionError" role="alert" class="mt-2 text-sm text-error">{{ actionError }}</p>
          </div>
          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" :disabled="working" @click="reconcile">Reconcile counts</UButton
            ><UButton :loading="working" @click="rebuild">Rebuild graph</UButton>
          </div>
        </section>
        <UCard>
          <div class="border-b border-default p-5">
            <h2 class="text-xl font-bold">Recent outbox events</h2>
            <p class="text-sm text-muted">
              Auto refreshes every 3 seconds · last event
              {{ data.projector.lastEventAt ? formatTimestamp(data.projector.lastEventAt) : '—' }}
            </p>
          </div>
          <UTable :data="eventRows" :columns="eventColumns" />
          <UEmpty
            v-if="!eventRows.length"
            icon="i-lucide-inbox"
            title="No recent events"
            description="New store activity will appear here."
          />
        </UCard>
        <QueryTracePanel :trace="data.trace" /></template
    ></LoadState>
  </div>
</template>
