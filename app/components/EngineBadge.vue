<script setup lang="ts">
import type { EngineId } from '#shared/types/api'

defineProps<{ engine: EngineId }>()

const styles: Record<EngineId, { label: string; color: 'warning' | 'success' | 'info' }> = {
  mysql: { label: 'MySQL', color: 'warning' },
  mongo: { label: 'MongoDB', color: 'success' },
  neo4j: { label: 'Neo4j', color: 'info' },
}
</script>

<template>
  <UBadge :color="styles[engine].color" variant="subtle">{{ styles[engine].label }}</UBadge>
</template>
