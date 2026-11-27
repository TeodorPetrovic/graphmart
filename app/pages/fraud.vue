<script setup lang="ts">
import type { FraudRing, FraudRingsResponse, FraudUserResponse, ReferralCyclesResponse } from '#shared/types/api'
import { DEMO } from '#shared/utils/demo'

const selectedUser = ref<number>(DEMO.fraudRingUserIds[0] ?? DEMO.userId)
const drawerOpen = ref(false)
const [{ data: rings, status, error }, { data: cycles, status: cyclesStatus, error: cyclesError }] = await Promise.all([
  useFetch<FraudRingsResponse>('/api/fraud/rings', { query: { minUsers: 3, limit: 20 } }),
  useFetch<ReferralCyclesResponse>('/api/fraud/referral-cycles'),
])
const {
  data: detail,
  status: detailStatus,
  error: detailError,
} = await useFetch<FraudUserResponse>(() => `/api/fraud/users/${selectedUser.value}`)
const emptyGraph = { nodes: [], edges: [] }
const shared = (ring: FraudRing) =>
  [ring.sharedCards && 'payment card', ring.sharedDevices && 'device', ring.sharedAddresses && 'address']
    .filter(Boolean)
    .join(', ')
function inspect(id: number) {
  selectedUser.value = id
  drawerOpen.value = true
}
</script>

<template>
  <div class="space-y-8">
    <PageSection title="Accounts that share payment or delivery details">
      <template #aside><InsightFeatureInsight feature="trust" :trace="rings?.trace" /></template>
      <LoadState :status="status" :error="error">
        <DataTable
          :rows="rings?.rings ?? []"
          :columns="[
            { key: 'userNames', label: 'Accounts' },
            { key: 'shared', label: 'Shared' },
            { key: 'riskScore', label: 'Risk (of 100)', align: 'right' },
            { key: 'review', label: '', align: 'right' },
          ]"
          :row-key="(ring) => ring.id"
          empty="No group of three or more accounts shares details."
        >
          <template #userNames="{ row }">{{ row.userNames.join(', ') }}</template>
          <template #shared="{ row }">{{ shared(row) }}</template>
          <template #review="{ row }">
            <UButton size="xs" color="neutral" variant="outline" @click="inspect(row.userIds[0]!)">Review</UButton>
          </template>
        </DataTable>
      </LoadState>
    </PageSection>

    <PageSection title="Referral loops" note="Chains of referrals that lead back to the first person.">
      <LoadState :status="cyclesStatus" :error="cyclesError">
        <ul v-if="cycles?.cycles.length" class="text-sm">
          <li v-for="cycle in cycles.cycles" :key="cycle.userIds.join('-')">
            {{ [...cycle.userNames, cycle.userNames[0]].join(' → ') }}
          </li>
        </ul>
        <p v-else class="text-sm text-muted">No loops found.</p>
        <ClientOnly>
          <GraphView v-if="cycles?.cycles.length" class="mt-3" :graph="cycles.graph ?? emptyGraph" height="340px" />
          <template #fallback><USkeleton class="mt-3 h-80 w-full" /></template>
        </ClientOnly>
      </LoadState>
    </PageSection>

    <USlideover
      v-model:open="drawerOpen"
      :title="detail?.user.name ?? `User #${selectedUser}`"
      description="Shared details are a reason to look closer. They do not prove fraud."
      :ui="{ content: 'max-w-3xl' }"
    >
      <template #body>
        <LoadState :status="detailStatus" :error="detailError">
          <div v-if="detail" class="space-y-6">
            <PageSection :title="`Risk score ${detail.riskScore} of 100`">
              <DataTable
                :rows="detail.signals"
                :columns="[
                  { key: 'label', label: 'Reason' },
                  { key: 'detail', label: 'Detail' },
                  { key: 'weight', label: 'Points', align: 'right' },
                ]"
              />
            </PageSection>
            <PageSection title="Connected accounts">
              <GraphView :graph="detail.graph" height="400px" />
            </PageSection>
            <InsightFeatureInsight feature="trust" :trace="detail.trace" />
          </div>
        </LoadState>
      </template>
    </USlideover>
  </div>
</template>
