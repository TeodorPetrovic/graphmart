<script setup lang="ts">
defineProps<{ error: { statusCode: number; statusMessage?: string; message?: string } }>()
const goHome = () => clearError({ redirect: '/' })
</script>

<template>
  <UApp>
    <main class="mx-auto max-w-xl space-y-3 px-4 py-16">
      <h1 class="text-2xl font-semibold">Error {{ error.statusCode }}</h1>
      <p>{{ error.statusMessage || error.message || 'The page could not be shown.' }}</p>
      <UButton @click="goHome">Go to the home page</UButton>
    </main>
  </UApp>
</template>
