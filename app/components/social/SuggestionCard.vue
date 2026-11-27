<script setup lang="ts">
import type { SuggestionsResponse } from '#shared/types/api'

type Suggestion = SuggestionsResponse['suggestions'][number]

defineProps<{
  suggestion: Suggestion
  busy: boolean
  disabled: boolean
}>()
const emit = defineEmits<{ follow: [userId: number] }>()
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">{{ suggestion.user.name }}</h2>
        <p class="text-muted">{{ suggestion.user.city }} · {{ suggestion.mutualCount }} mutual connections</p>
      </div>
      <UBadge>{{ suggestion.score.toFixed(1) }}</UBadge>
    </div>
    <p class="mt-3 text-sm">
      {{ suggestion.mutualNames.join(', ') || 'Connected through your wider network' }}
    </p>
    <UButton class="mt-4" size="sm" :loading="busy" :disabled="disabled" @click="emit('follow', suggestion.user.id)">
      Follow
    </UButton>
  </UCard>
</template>
