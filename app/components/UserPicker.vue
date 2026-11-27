<script setup lang="ts">
import type { UserListResponse, UserProfileResponse } from '#shared/types/api'

/** Search users by name (GET /api/users) and pick one. v-model is the user id. */
const model = defineModel<number>({ required: true })
defineProps<{ label?: string }>()
const optionsId = `user-picker-options-${useId()}`

const term = ref('')
const query = ref('')
const focused = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (query.value = value.trim()), 200)
})
onBeforeUnmount(() => clearTimeout(timer))

const { data, status, error } = useFetch<UserListResponse>('/api/users', {
  query: { q: query, limit: 8 },
  server: false,
  lazy: true,
})

const { data: selected } = useFetch<UserProfileResponse>(() => `/api/users/${model.value}`, {
  server: false,
  lazy: true,
})
const selectedLabel = computed(() =>
  selected.value ? `${selected.value.user.name} (#${model.value})` : `User #${model.value}`,
)

function pick(id: number) {
  model.value = id
  term.value = ''
  focused.value = false
}

function handleFocusOut(event: FocusEvent) {
  const root = event.currentTarget
  const nextTarget = event.relatedTarget
  focused.value = root instanceof HTMLElement && nextTarget instanceof Node && root.contains(nextTarget)
}
</script>

<template>
  <div class="relative w-full max-w-72" @focusin="focused = true" @focusout="handleFocusOut">
    <UFormField :label="label ?? 'User'" :help="selectedLabel">
      <UInput
        v-model="term"
        class="w-full"
        placeholder="Search by name..."
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        :aria-controls="optionsId"
        :aria-expanded="focused && Boolean(data?.items.length)"
      />
    </UFormField>
    <ul
      v-if="focused && data?.items.length"
      :id="optionsId"
      class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-default bg-default shadow-lg"
      role="listbox"
    >
      <li v-for="user in data.items" :key="user.id">
        <button
          type="button"
          class="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-elevated"
          role="option"
          :aria-selected="model === user.id"
          @click="pick(user.id)"
        >
          <span>{{ user.name }}</span><span class="text-muted">#{{ user.id }} · {{ user.city }}</span>
        </button>
      </li>
    </ul>
    <p v-if="focused && status === 'pending'" class="mt-1 text-xs text-muted" role="status">Searching users…</p>
    <p v-if="focused && error" class="mt-1 text-xs text-error" role="alert">
      {{ apiErrorMessage(error, 'Could not search users.') }}
    </p>
    <p v-if="focused && status === 'success' && !data?.items.length" class="mt-1 text-xs text-muted">
      No matching users.
    </p>
  </div>
</template>
