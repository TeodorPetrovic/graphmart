let tail: Promise<void> = Promise.resolve()

/** Serializes full rebuilds and event projections so snapshot writes cannot interleave. */
export async function withProjectionLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = tail
  let release = () => {}
  tail = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await work()
  } finally {
    release()
  }
}
