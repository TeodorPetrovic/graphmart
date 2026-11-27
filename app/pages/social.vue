<script setup lang="ts">
import type {
  FollowResponse,
  NetworkResponse,
  PathResponse,
  ReferralResponse,
  SuggestionsResponse,
  UserProfileResponse,
} from '#shared/types/api'
import { DEMO } from '#shared/utils/demo'
import { useActiveUser } from '~/composables/useActiveUser'

const activeUser = useActiveUser()
const selectedUser = ref(activeUser.value)
const fromUser = ref(DEMO.userId)
const toUser = ref(DEMO.distantUserId)
const tab = ref('discover')
const tabs = [
  { label: 'Discover', value: 'discover', icon: 'i-lucide-users' },
  { label: 'Your circle', value: 'circle', icon: 'i-lucide-orbit' },
  { label: 'How are we connected?', value: 'path', icon: 'i-lucide-route' },
  { label: 'Referrals', value: 'referrals', icon: 'i-lucide-user-plus' },
]
const [
  { data: profile, status: profileStatus, error: profileError },
  { data: suggestions, status: suggestionStatus, error: suggestionError, refresh: refreshSuggestions },
  { data: network, status: networkStatus, error: networkError },
  { data: path, status: pathStatus, error: pathError },
  { data: referrals, status: referralStatus, error: referralError },
] = await Promise.all([
  useFetch<UserProfileResponse>(() => `/api/users/${selectedUser.value}`),
  useFetch<SuggestionsResponse>(() => `/api/social/${selectedUser.value}/suggestions`, { query: { limit: 8 } }),
  useFetch<NetworkResponse>(() => `/api/social/${selectedUser.value}/network`, { query: { depth: 3, limit: 100 } }),
  useFetch<PathResponse>('/api/social/path', { query: { from: fromUser, to: toUser, maxDepth: 8 } }),
  useFetch<ReferralResponse>(() => `/api/social/${selectedUser.value}/referrals`),
])
const busyUser = ref<number | null>(null)
const emptyGraph = { nodes: [], edges: [] }
const pathPeople = computed(() => path.value?.paths[0] ?? [])
const referralRows = computed(() =>
  (referrals.value?.levels ?? []).map((level) => ({
    level: `Level ${level.level}`,
    people: level.users,
    purchases: new Intl.NumberFormat().format(level.revenueCents / 100) + ' €',
  })),
)
const referralColumns = [
  { accessorKey: 'level', header: 'Level' },
  { accessorKey: 'people', header: 'People' },
  { accessorKey: 'purchases', header: 'Purchases' },
]
watch(selectedUser, () => {
  void refreshSuggestions()
})

async function follow(id: number) {
  busyUser.value = id
  try {
    await $fetch<FollowResponse>('/api/social/follow', {
      method: 'POST',
      body: { followerId: selectedUser.value, followeeId: id },
    })
    useToast().add({ title: 'Following', description: 'You will see more from this person.', color: 'success' })
    await refreshSuggestions()
  } catch {
    useToast().add({ title: 'Could not follow', description: 'Please try again in a moment.', color: 'error' })
  } finally {
    busyUser.value = null
  }
}
function useDemoPair() {
  fromUser.value = DEMO.userId
  toUser.value = DEMO.distantUserId
}
</script>

<template>
  <main class="space-y-6 p-6 lg:p-8">
    <PageHeader
      eyebrow="Community"
      title="People"
      description="Find people with shared interests, follow your circle and see how your community grows."
    />
    <LoadState :status="profileStatus" :error="profileError">
      <UCard v-if="profile" class="max-w-2xl">
        <div class="flex items-center gap-4">
          <UAvatar :alt="profile.user.name" size="xl" />
          <div class="grow">
            <h2 class="text-xl font-semibold">{{ profile.user.name }}</h2>
            <p class="text-muted">{{ profile.user.city }}</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold">{{ profile.social.followers }}</p>
            <p class="text-sm text-muted">followers</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold">{{ profile.social.following }}</p>
            <p class="text-sm text-muted">following</p>
          </div>
        </div>
      </UCard>
    </LoadState>
    <UTabs v-model="tab" :items="tabs" :content="false" />
    <section v-if="tab === 'discover'" class="space-y-4">
      <InsightFeatureInsight feature="people" :trace="suggestions?.trace" />
      <UserPicker v-model="selectedUser" label="Discover from" />
      <LoadState :status="suggestionStatus" :error="suggestionError">
        <UEmpty
          v-if="!suggestions?.suggestions.length"
          icon="i-lucide-users"
          title="No suggestions yet"
          description="There are no new people to show for this profile."
        />
        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="item in suggestions.suggestions" :key="item.user.id">
            <div class="flex items-start gap-3">
              <UAvatar :alt="item.user.name" />
              <div class="grow">
                <h3 class="font-semibold">{{ item.user.name }}</h3>
                <p class="text-sm text-muted">{{ item.user.city }}</p>
              </div>
              <UBadge color="neutral" variant="subtle">{{ item.mutualCount }} mutual</UBadge>
            </div>
            <div v-if="item.mutualNames.length" class="mt-4 flex items-center gap-3">
              <UAvatarGroup size="sm" :max="4"
                ><UAvatar v-for="name in item.mutualNames" :key="name" :alt="name"
              /></UAvatarGroup>
              <p class="text-sm text-muted">
                {{ item.mutualNames.slice(0, 2).join(' and ') }}
                {{ item.mutualNames.length === 1 ? 'also follows' : 'also follow' }} them
              </p>
            </div>
            <UButton
              class="mt-4"
              :loading="busyUser === item.user.id"
              :disabled="busyUser !== null"
              icon="i-lucide-user-plus"
              @click="follow(item.user.id)"
              >Follow</UButton
            >
          </UCard>
        </div>
      </LoadState>
    </section>
    <section v-else-if="tab === 'circle'" class="space-y-4">
      <LoadState :status="networkStatus" :error="networkError">
        <UPageGrid class="grid-cols-1 md:grid-cols-3">
          <UCard v-for="item in network?.countsByDepth ?? []" :key="item.depth" class="text-center"
            ><p class="text-sm text-muted">{{ item.depth }} {{ item.depth === 1 ? 'step' : 'steps' }} away</p>
            <p class="my-2 text-4xl font-bold tabular-nums">{{ item.users }}</p>
            <p class="text-sm text-muted">people in your circle</p></UCard
          >
        </UPageGrid>
        <p class="text-muted">Your circle grows as you include friends of friends across up to three steps.</p>
        <details class="rounded-xl border border-default p-4">
          <summary class="cursor-pointer font-semibold">Show connections</summary>
          <div class="mt-4">
            <GraphView :graph="network?.graph ?? emptyGraph" height="460px" :edge-labels="false" />
          </div>
        </details>
      </LoadState>
    </section>
    <section v-else-if="tab === 'path'" class="space-y-4">
      <InsightFeatureInsight feature="connection" :trace="path?.trace" />
      <div class="flex flex-wrap items-end gap-4">
        <UserPicker v-model="fromUser" label="First person" /><UserPicker
          v-model="toUser"
          label="Second person"
        /><UButton variant="soft" @click="useDemoPair">Try user 1 to user 50</UButton>
      </div>
      <LoadState :status="pathStatus" :error="pathError">
        <UCard v-if="path?.found" class="space-y-4"
          ><div>
            <h2 class="text-xl font-semibold">{{ path.length }} steps apart</h2>
            <p class="text-muted">Here is the shortest follow chain between these people.</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <template v-for="(person, index) in pathPeople" :key="person.id"
              ><UAvatar :alt="person.name" size="lg" /><span class="font-medium">{{ person.name }}</span
              ><span v-if="index < pathPeople.length - 1" class="flex items-center gap-2 text-sm text-muted"
                ><UIcon name="i-lucide-arrow-right" />follows</span
              ></template
            >
          </div>
          <details class="rounded-lg border border-default p-3">
            <summary class="cursor-pointer font-medium">Show connection map</summary>
            <div class="mt-3"><GraphView :graph="path.graph" height="360px" /></div></details
        ></UCard>
        <UEmpty
          v-else
          icon="i-lucide-route"
          title="No connection found"
          description="These people are not connected within the search range."
        />
      </LoadState>
    </section>
    <section v-else class="space-y-4">
      <UserPicker v-model="selectedUser" label="Referral root" />
      <InsightFeatureInsight feature="referrals" :trace="referrals?.trace" />
      <LoadState :status="referralStatus" :error="referralError"
        ><UTable :data="referralRows" :columns="referralColumns" /><UEmpty
          v-if="!referralRows.length"
          icon="i-lucide-user-plus"
          title="No referrals yet"
          description="New members and purchases will appear here." />
        <details class="rounded-xl border border-default p-4">
          <summary class="cursor-pointer font-semibold">Show referral tree</summary>
          <div class="mt-4"><GraphView :graph="referrals?.graph ?? emptyGraph" height="400px" /></div></details
      ></LoadState>
    </section>
  </main>
</template>
