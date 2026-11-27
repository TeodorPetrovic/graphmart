<script setup lang="ts">
defineProps<{ error: { statusCode: number; statusMessage?: string; message?: string } }>()
const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <UApp>
    <main class="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-5 px-6">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">GraphMart</p>
      <h1 class="text-4xl font-bold">{{ error.statusCode }} · Something went wrong</h1>
      <p class="text-lg text-muted">{{ error.statusMessage || error.message || 'The page could not be displayed.' }}</p>
      <UButton @click="handleError">Return to overview</UButton>
    </main>
  </UApp>
</template>
