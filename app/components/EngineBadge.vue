<script setup lang="ts">
import type { EngineId } from '#shared/types/api'
import { ENGINE_NAMES } from '~/utils/engine-names'

defineProps<{ engine: EngineId }>()
</script>

<template>
  <UBadge color="neutral" variant="outline">{{ ENGINE_NAMES[engine] }}</UBadge>
</template>
