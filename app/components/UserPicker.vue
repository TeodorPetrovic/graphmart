<script setup lang="ts">
import type { UserListResponse, UserProfileResponse } from '#shared/types/api'

/** Search users by name (GET /api/users) and pick one. v-model is the user id. */
const model = defineModel<number>({ required: true })
defineProps<{ label: string }>()

const term = ref('')
const query = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (query.value = value.trim()), 200)
})
onBeforeUnmount(() => clearTimeout(timer))

const { data } = useFetch<UserListResponse>('/api/users', {
  query: { q: query, limit: 8 },
  server: false,
  lazy: true,
})
const { data: selected } = useFetch<UserProfileResponse>(() => `/api/users/${model.value}`, {
  server: false,
  lazy: true,
})

/** The chosen user stays in the list, so its name shows while other names are searched. */
const items = computed(() => {
  const found = (data.value?.items ?? []).map((user) => ({ label: `${user.name} (#${user.id})`, value: user.id }))
  if (found.some((item) => item.value === model.value)) return found
  const name = selected.value?.user.id === model.value ? selected.value.user.name : 'User'
  return [{ label: `${name} (#${model.value})`, value: model.value }, ...found]
})
</script>

<template>
  <UFormField :label="label" class="w-full max-w-72">
    <USelectMenu
      v-model="model"
      v-model:search-term="term"
      :items="items"
      value-key="value"
      :search-input="{ placeholder: 'Search by name' }"
      ignore-filter
      class="w-full"
    />
  </UFormField>
</template>
