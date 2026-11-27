<script setup lang="ts">
import { LECTURE_PLAN } from '~/utils/lecture-plan'

const lectureTabs = LECTURE_PLAN.map((item) => ({ label: `Class ${item.number}`, value: item.number }))
const selected = ref<number>(1)
const checked = ref<Record<string, boolean>>({})
const timer = usePresentationTimer()
const lecture = computed(() => LECTURE_PLAN.find((item) => item.number === selected.value) ?? LECTURE_PLAN[0]!)
const totalMinutes = computed(() => lecture.value.steps.reduce((total, step) => total + step.minutes, 0))
watch(selected, () => {
  timer.pause()
  timer.reset()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UTabs v-model="selected" :items="lectureTabs" :content="false" variant="link" color="neutral" />
      <div class="flex items-center gap-2">
        <span class="mr-2 text-2xl font-semibold tabular-nums" role="timer" aria-live="off">{{ timer.display }}</span>
        <UButton @click="timer.running ? timer.pause() : timer.start()">
          {{ timer.running ? 'Pause' : 'Start' }}
        </UButton>
        <UButton color="neutral" variant="outline" @click="timer.reset">Reset</UButton>
      </div>
    </div>
    <PageSection :title="lecture.title" :note="`${lecture.focus} ${totalMinutes} minutes.`">
      <ol class="divide-y divide-default border-y border-default">
        <li v-for="step in lecture.steps" :key="step.id" class="flex gap-4 py-3 text-sm">
          <UCheckbox v-model="checked[step.id]" :aria-label="`Done: ${step.title}`" />
          <span class="w-14 shrink-0 text-muted tabular-nums">{{ step.minutes }} min</span>
          <div class="grow space-y-1">
            <h3 class="font-semibold">{{ step.title }}</h3>
            <p>Say: {{ step.say }}</p>
            <p class="text-muted">Show: {{ step.show }}</p>
            <p class="flex flex-wrap gap-4">
              <ULink v-for="item in step.links" :key="item.to" :to="item.to" class="underline">{{ item.label }}</ULink>
            </p>
          </div>
        </li>
      </ol>
    </PageSection>
  </div>
</template>
