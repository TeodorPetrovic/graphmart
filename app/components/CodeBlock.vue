<script setup lang="ts">
defineProps<{ code: string }>()
</script>

<template>
  <pre class="max-h-96 overflow-auto rounded-md border border-default bg-elevated/50 p-3 text-xs leading-relaxed">{{
    code
  }}</pre>
</template>
