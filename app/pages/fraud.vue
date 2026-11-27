<script setup lang="ts">
import type { FraudRingsResponse, FraudUserResponse, ReferralCyclesResponse } from '#shared/types/api'
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
function inspect(id: number) {
  selectedUser.value = id
  drawerOpen.value = true
}
</script>

<template>
  <main class="space-y-6 p-6 lg:p-8">
    <PageHeader
      eyebrow="Store team"
      title="Trust & safety"
      description="Review accounts connected by shared payment cards, devices or delivery addresses."
    />
    <InsightFeatureInsight feature="trust" :trace="rings?.trace" />
    <UCard>
      <template #header
        ><div>
          <h2 class="text-xl font-semibold">Open cases</h2>
          <p class="text-sm text-muted">Connected accounts with multiple shared signals.</p>
        </div></template
      >
      <LoadState :status="status" :error="error">
        <ul v-if="rings?.rings.length" class="space-y-4">
          <li v-for="ring in rings.rings" :key="ring.id" class="rounded-lg border border-default p-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="min-w-0 space-y-2">
                <p class="text-lg font-semibold">{{ ring.userIds.length }} connected accounts</p>
                <p class="text-sm text-muted">{{ ring.userNames.join(', ') }}</p>
                <div class="flex flex-wrap gap-2">
                  <UBadge v-if="ring.sharedCards" color="warning" variant="subtle" icon="i-lucide-credit-card">
                    Shared payment card
                  </UBadge>
                  <UBadge v-if="ring.sharedDevices" color="info" variant="subtle" icon="i-lucide-smartphone">
                    Shared device
                  </UBadge>
                  <UBadge v-if="ring.sharedAddresses" color="primary" variant="subtle" icon="i-lucide-map-pin">
                    Shared address
                  </UBadge>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <UBadge color="error" size="lg">Risk {{ ring.riskScore }} / 100</UBadge>
                <UButton icon="i-lucide-search" @click="inspect(ring.userIds[0]!)">Review case</UButton>
              </div>
            </div>
          </li>
        </ul>
        <UEmpty
          v-else
          icon="i-lucide-shield-check"
          title="No open cases"
          description="No account groups currently meet the review threshold."
        />
      </LoadState>
    </UCard>
    <UCard>
      <template #header
        ><div>
          <h2 class="text-xl font-semibold">Referral loops</h2>
          <p class="text-sm text-muted">
            A referral loop means the chain eventually points back to an earlier member, so it cannot be treated as a
            simple family tree.
          </p>
        </div></template
      >
      <LoadState :status="cyclesStatus" :error="cyclesError"
        ><div v-if="cycles?.cycles.length" class="space-y-3">
          <UAlert
            v-for="cycle in cycles.cycles"
            :key="cycle.userIds.join('-')"
            color="warning"
            variant="subtle"
            icon="i-lucide-repeat-2"
            :title="`${cycle.length} people in a referral loop`"
            :description="`${cycle.userNames.join(' → ')} → ${cycle.userNames[0]}`"
          /><ClientOnly>
            <GraphView :graph="cycles?.graph ?? emptyGraph" height="340px" />
            <template #fallback><USkeleton class="h-80 w-full" /></template>
          </ClientOnly>
        </div>
        <UEmpty v-else icon="i-lucide-circle-check" title="No referral loops found"
      /></LoadState>
    </UCard>
    <USlideover
      v-model:open="drawerOpen"
      title="Case review"
      :description="`Reviewing ${detail?.user.name ?? `member #${selectedUser}`}`"
      :ui="{ content: 'max-w-3xl' }"
    >
      <template #body
        ><LoadState :status="detailStatus" :error="detailError"
          ><div v-if="detail" class="space-y-5">
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-shield-alert"
              :title="`${detail.user.name} has a ${detail.riskScore}% risk score`"
              description="This score comes from account details shared with other members. It is a prompt for review, not a finding of wrongdoing."
            /><UCard
              ><template #header><h3 class="font-semibold">Why this case was flagged</h3></template>
              <ul class="space-y-4">
                <li
                  v-for="signal in detail.signals"
                  :key="signal.label"
                  class="flex gap-3 border-b border-default pb-3 last:border-0"
                >
                  <UBadge color="warning">+{{ signal.weight }}</UBadge>
                  <div>
                    <p class="font-medium">{{ signal.label }}</p>
                    <p class="text-sm text-muted">{{ signal.detail }}</p>
                  </div>
                </li>
              </ul></UCard
            >
            <div>
              <h3 class="mb-2 font-semibold">How the accounts are connected</h3>
              <GraphView :graph="detail.graph" height="400px" />
            </div>
            <InsightFeatureInsight feature="trust" :trace="detail.trace" /></div></LoadState
      ></template>
    </USlideover>
  </main>
</template>
