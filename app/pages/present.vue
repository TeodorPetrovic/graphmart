<script setup lang="ts">
import { LECTURE_PLAN } from '~/utils/lecture-plan'

const selectedLecture = ref<1 | 2>(1)
const checked = ref<Record<string, boolean>>({})
const timer = usePresentationTimer()
const lecture = computed(() => LECTURE_PLAN.find((item) => item.number === selectedLecture.value) ?? LECTURE_PLAN[0]!)
const totalMinutes = computed(() => lecture.value.steps.reduce((total, step) => total + step.minutes, 0))
const completeCount = computed(() => lecture.value.steps.filter((step) => checked.value[step.id]).length)
function changeLecture(value: 1 | 2) {
  timer.pause()
  selectedLecture.value = value
  timer.reset()
}
const lectureTabs = LECTURE_PLAN.map((item) => ({ label: `Class ${item.number}`, value: item.number }))
function selectLecture(value: number | string) {
  if (value === 1 || value === 2) changeLecture(value)
}
</script>

<template>
  <main class="space-y-6 p-6 lg:p-8">
    <PageHeader
      title="Presenter guide"
      description="Two 45 minute classes with a live agenda, notes, timer, and step checklist."
    />
    <div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-default p-4">
      <UTabs :model-value="selectedLecture" :items="lectureTabs" :content="false" @update:model-value="selectLecture" />
      <div class="flex items-center gap-3">
        <span class="text-3xl font-bold tabular-nums" role="timer" aria-live="off">{{ timer.display }}</span><UButton
          @click="timer.running ? timer.pause() : timer.start()"
          >{{ timer.running ? 'Pause' : 'Start' }}</UButton
        ><UButton variant="outline" @click="timer.reset">Reset</UButton>
      </div>
    </div>
    <section class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold">{{ lecture.title }}</h2>
        <p class="mt-1 text-muted">{{ lecture.focus }}</p>
      </div>
      <p class="text-sm text-muted">
        {{ totalMinutes }} planned minutes · {{ completeCount }}/{{ lecture.steps.length }} complete
      </p>
    </section>
    <ol class="space-y-3">
      <li
        v-for="(step, index) in lecture.steps"
        :key="step.id"
        class="grid gap-4 rounded-xl border border-default p-4 lg:grid-cols-[auto_1fr_auto]"
      >
        <div class="flex items-start gap-3">
          <UCheckbox v-model="checked[step.id]" :aria-label="`Mark ${step.title} complete`" /><span
            class="font-mono text-sm text-muted"
            >{{ String(index + 1).padStart(2, '0') }} · {{ step.minutes }} min</span
          >
        </div>
        <div>
          <h3 class="text-lg font-semibold">{{ step.title }}</h3>
          <div class="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <p><strong>Say:</strong> {{ step.say }}</p>
            <p><strong>Show:</strong> {{ step.show }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-start gap-2 lg:flex-col">
          <UButton v-for="link in step.links" :key="link.to" :to="link.to" variant="soft">{{ link.label }}</UButton>
        </div>
      </li>
    </ol>
  </main>
</template>
