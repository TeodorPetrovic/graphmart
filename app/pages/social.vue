<script setup lang="ts">
import type {
  FollowResponse,
  NetworkResponse,
  PathResponse,
  ReferralResponse,
  SuggestionsResponse,
  UserProfileResponse,
} from '#shared/types/api'
import { DEMO, formatPrice } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'

const TABS = [
  { label: 'Suggestions', value: 'discover' },
  { label: 'Network', value: 'circle' },
  { label: 'Connect two people', value: 'path' },
  { label: 'Referrals', value: 'referrals' },
]
const userId = useActiveUser()
const toast = useToast()
const tab = ref('discover')
const fromUser = ref<number>(DEMO.userId)
const toUser = ref<number>(DEMO.distantUserId)
const [
  { data: profile },
  { data: suggestions, status: suggestionStatus, error: suggestionError, refresh: refreshSuggestions },
  { data: network, status: networkStatus, error: networkError },
  { data: path, status: pathStatus, error: pathError },
  { data: referrals, status: referralStatus, error: referralError },
] = await Promise.all([
  useFetch<UserProfileResponse>(() => `/api/users/${userId.value}`),
  useFetch<SuggestionsResponse>(() => `/api/social/${userId.value}/suggestions`, { query: { limit: 8 } }),
  useFetch<NetworkResponse>(() => `/api/social/${userId.value}/network`, { query: { depth: 3, limit: 100 } }),
  useFetch<PathResponse>('/api/social/path', { query: { from: fromUser, to: toUser, maxDepth: 8 } }),
  useFetch<ReferralResponse>(() => `/api/social/${userId.value}/referrals`),
])
const emptyGraph = { nodes: [], edges: [] }
const chain = computed(() => path.value?.paths[0]?.map((person) => person.name).join(' → '))

const busyUser = ref<number | null>(null)
async function follow(id: number) {
  busyUser.value = id
  try {
    await $fetch<FollowResponse>('/api/social/follow', {
      method: 'POST',
      body: { followerId: userId.value, followeeId: id },
    })
    toast.add({ title: 'Followed' })
    await refreshSuggestions()
  } catch (cause) {
    toast.add({ title: 'Could not follow', description: apiErrorMessage(cause), color: 'error' })
  } finally {
    busyUser.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <p v-if="profile" class="text-sm">
      <span class="font-semibold">{{ profile.user.name }}</span>
      <span class="text-muted">
        , {{ profile.user.city }}. {{ profile.social.followers }} followers, follows {{ profile.social.following }}.
      </span>
    </p>
    <UTabs v-model="tab" :items="TABS" :content="false" variant="link" color="neutral" />

    <PageSection v-if="tab === 'discover'" title="People you may know">
      <template #aside><InsightFeatureInsight feature="people" :trace="suggestions?.trace" /></template>
      <LoadState :status="suggestionStatus" :error="suggestionError">
        <DataTable
          :rows="suggestions?.suggestions ?? []"
          :columns="[
            { key: 'user', label: 'Name' },
            { key: 'mutualNames', label: 'Followed by people you follow' },
            { key: 'mutualCount', label: 'In common', align: 'right' },
            { key: 'follow', label: '', align: 'right' },
          ]"
          :row-key="(item) => item.user.id"
          empty="No suggestions for this person."
        >
          <template #user="{ row }">
            <p class="font-medium">{{ row.user.name }}</p>
            <p class="text-muted">{{ row.user.city }}</p>
          </template>
          <template #mutualNames="{ row }">{{ row.mutualNames.join(', ') }}</template>
          <template #follow="{ row }">
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              :loading="busyUser === row.user.id"
              :disabled="busyUser !== null"
              @click="follow(row.user.id)"
            >
              Follow
            </UButton>
          </template>
        </DataTable>
      </LoadState>
    </PageSection>

    <PageSection v-else-if="tab === 'circle'" title="People reachable through follows">
      <LoadState :status="networkStatus" :error="networkError">
        <StatRow
          :stats="
            (network?.countsByDepth ?? []).map((item) => ({
              label: `${item.depth} ${item.depth === 1 ? 'step' : 'steps'} away`,
              value: formatCount(item.users),
            }))
          "
        />
        <GraphView class="mt-4" :graph="network?.graph ?? emptyGraph" height="460px" :edge-labels="false" />
      </LoadState>
    </PageSection>

    <PageSection v-else-if="tab === 'path'" title="Shortest chain of follows">
      <template #aside><InsightFeatureInsight feature="connection" :trace="path?.trace" /></template>
      <div class="flex flex-wrap items-end gap-3">
        <UserPicker v-model="fromUser" label="From" />
        <UserPicker v-model="toUser" label="To" />
      </div>
      <LoadState :status="pathStatus" :error="pathError">
        <template v-if="path?.found">
          <p>
            <span class="font-semibold">{{ path.length }} steps.</span> {{ chain }}
          </p>
          <GraphView :graph="path.graph" height="360px" />
        </template>
        <p v-else class="text-sm text-muted">No chain found within 8 steps.</p>
      </LoadState>
    </PageSection>

    <PageSection v-else title="People referred, by level">
      <template #aside><InsightFeatureInsight feature="referrals" :trace="referrals?.trace" /></template>
      <LoadState :status="referralStatus" :error="referralError">
        <DataTable
          :rows="referrals?.levels ?? []"
          :columns="[
            { key: 'level', label: 'Level' },
            { key: 'users', label: 'People', align: 'right' },
            { key: 'revenueCents', label: 'Purchases', align: 'right' },
          ]"
          empty="No referrals yet."
        >
          <template #revenueCents="{ row }">{{ formatPrice(row.revenueCents) }}</template>
        </DataTable>
        <GraphView
          v-if="referrals?.levels.length"
          class="mt-4"
          :graph="referrals?.graph ?? emptyGraph"
          height="400px"
        />
      </LoadState>
    </PageSection>
  </div>
</template>
