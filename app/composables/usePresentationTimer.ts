export function usePresentationTimer() {
  const remainingSeconds = ref(45 * 60)
  const running = ref(false)
  const display = computed(
    () =>
      `${String(Math.floor(remainingSeconds.value / 60)).padStart(2, '0')}:${String(remainingSeconds.value % 60).padStart(2, '0')}`,
  )
  let interval: ReturnType<typeof setInterval> | undefined

  function pause() {
    running.value = false
    if (interval) clearInterval(interval)
    interval = undefined
  }

  function start() {
    pause()
    running.value = true
    interval = setInterval(() => {
      if (remainingSeconds.value > 0) remainingSeconds.value -= 1
      else pause()
    }, 1000)
  }

  function reset() {
    pause()
    remainingSeconds.value = 45 * 60
  }

  onBeforeUnmount(pause)
  return { display, running, start, pause, reset }
}
